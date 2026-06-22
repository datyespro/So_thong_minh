-- TIP-DC-3 (REQ-03): nhãn nhóm cho cọc — payments +2 cột scope + commit_payment v4.
--
-- Forward-only, dựng trên v3 (20260620130000). Hai phần:
--  (S1) ALTER payments: thêm scope_product_id / scope_category_id (nullable, loại trừ
--       nhau bằng CHECK) + 2 index owner-scoped phục vụ đối chiếu nhóm (DC-5).
--  (S2) DROP commit_payment v3 (6-param) → CREATE v4 (8-param). v4 = CLONE NGUYÊN VĂN
--       v3, chỉ 3 delta: (1) +2 tham số scope DEFAULT NULL; (2) guard xác minh nhãn
--       (owner + còn sống + loại trừ); (3) INSERT thêm 2 cột scope. Mọi dòng khác
--       byte-identical v3 (idempotency, paid_at/business_date, method, sync, audit,
--       return, ON CONFLICT). 2 tham số DEFAULT NULL ⇒ caller 6-arg cũ vẫn resolve →
--       ghi cọc thường scope NULL ⇒ tương thích ngược 100%. KHÔNG đụng app TS.

-- ============================== S1 — ALTER payments ==============================

ALTER TABLE public.payments
  ADD COLUMN scope_product_id  UUID REFERENCES public.products(id)           ON DELETE SET NULL,
  ADD COLUMN scope_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_scope_single_chk
  CHECK ( (scope_product_id IS NOT NULL)::int + (scope_category_id IS NOT NULL)::int <= 1 );

CREATE INDEX payments_owner_scope_category_idx
  ON public.payments (owner_id, scope_category_id) WHERE scope_category_id IS NOT NULL;
CREATE INDEX payments_owner_scope_product_idx
  ON public.payments (owner_id, scope_product_id) WHERE scope_product_id IS NOT NULL;

-- ========================= S2 — commit_payment v3 → v4 ==========================

DROP FUNCTION IF EXISTS public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE);

CREATE FUNCTION public.commit_payment(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_note TEXT,
  p_business_date DATE,
  p_scope_product_id  UUID DEFAULT NULL,   -- DELTA 1
  p_scope_category_id UUID DEFAULT NULL    -- DELTA 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_payment_id UUID;
  v_existing_id UUID;
  v_existing_amount NUMERIC(14,0);
  v_existing_date DATE;
  v_debt NUMERIC(14,0);
  v_new_debt NUMERIC(14,0);
  v_method TEXT;
  v_paid_at TIMESTAMPTZ;
  v_business_date DATE;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required' USING ERRCODE = '23502';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive number' USING ERRCODE = '22023';
  END IF;

  -- Ngày trả: VN-midnight của ngày người dùng nói, hoặc now() nếu không nói.
  v_paid_at := COALESCE((p_business_date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'), now());
  v_business_date := COALESCE(p_business_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE);

  -- Idempotency fast path.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, amount, (paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      INTO v_existing_id, v_existing_amount, v_existing_date
    FROM public.payments
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'payment_id', v_existing_id,
        'amount', v_existing_amount,
        'new_debt_total', (SELECT debt_total FROM public.customers WHERE id = p_customer_id AND owner_id = v_owner),
        'business_date', v_existing_date,
        'idempotent_reuse', true
      );
    END IF;
  END IF;

  -- Đọc nợ để check khách tồn tại; KHÔNG chặn overpay (VĐ3 cho phép trả dư → nợ âm).
  SELECT debt_total INTO v_debt
  FROM public.customers
  WHERE id = p_customer_id AND owner_id = v_owner;

  IF v_debt IS NULL THEN
    RAISE EXCEPTION 'customer not found for this owner' USING ERRCODE = '23503';
  END IF;

  -- DELTA 2 — xác minh nhãn scope (server-side, KHÔNG tin client). Reuse-path ở trên
  -- đã RETURN trước khối này nên cọc idempotent cũ không bị kiểm/ghi lại scope.
  IF p_scope_product_id IS NOT NULL AND p_scope_category_id IS NOT NULL THEN
    RAISE EXCEPTION 'scope must be product OR category, not both' USING ERRCODE = '22023';
  END IF;
  IF p_scope_product_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.products
       WHERE id = p_scope_product_id AND owner_id = v_owner
         AND is_active = TRUE AND deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'scope_product not found for this owner' USING ERRCODE = '23503';
  END IF;
  IF p_scope_category_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.product_categories
       WHERE id = p_scope_category_id AND owner_id = v_owner
         AND deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'scope_category not found for this owner' USING ERRCODE = '23503';
  END IF;

  -- Only the three allowed methods survive; anything else becomes NULL.
  v_method := CASE
    WHEN NULLIF(btrim(p_method), '') IN ('cash', 'bank_transfer', 'other')
      THEN btrim(p_method)
    ELSE NULL
  END;

  INSERT INTO public.payments (
    owner_id, customer_id, amount, method, raw_input, idempotency_key, paid_at,
    scope_product_id, scope_category_id                       -- DELTA 3
  ) VALUES (
    v_owner, p_customer_id, p_amount, v_method, p_note, p_idempotency_key, v_paid_at,
    p_scope_product_id, p_scope_category_id                   -- DELTA 3
  )
  ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    SELECT id, amount, (paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      INTO v_existing_id, v_existing_amount, v_existing_date
    FROM public.payments
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
      'payment_id', v_existing_id,
      'amount', v_existing_amount,
      'new_debt_total', (SELECT debt_total FROM public.customers WHERE id = p_customer_id AND owner_id = v_owner),
      'business_date', v_existing_date,
      'idempotent_reuse', true
    );
  END IF;

  -- Recompute debt once (RECOMPUTES from source; never adjust by hand).
  PERFORM public.sync_customer_debt_total(v_owner, p_customer_id);
  SELECT debt_total INTO v_new_debt
  FROM public.customers WHERE id = p_customer_id AND owner_id = v_owner;

  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'payment', v_payment_id, 'create');

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'amount', p_amount,
    'new_debt_total', v_new_debt,
    'business_date', v_business_date,
    'idempotent_reuse', false
  );
END;
$$;

-- Authenticated end users only (least-privilege, matching tip007b). Never anon/public.
-- Chữ ký 8-param mới (sau DROP v3, còn ĐÚNG 1 overload).
REVOKE ALL ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE, UUID, UUID) TO authenticated;
