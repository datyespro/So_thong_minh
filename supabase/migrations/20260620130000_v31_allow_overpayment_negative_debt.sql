-- TIP-V3-1 (VĐ3 bước 1): commit_payment v3 — cho phép trả/đặt trước VƯỢT nợ.
--
-- Forward-only, dựng trên v2 (20260620120000). DROP chữ ký 6-tham-số của v2 rồi
-- CREATE lại Y HỆT, chỉ BỎ khối guard "p_amount > v_debt RAISE 'exceeds'".
-- Overpayment cho phép → debt_total xuống ÂM = mình nợ lại khách (VĐ3).
-- sync_customer_debt_total KHÔNG kẹp ≥0 nên debt tự cho âm; customers KHÔNG có
-- CHECK debt_total nên không cần đụng constraint. Mọi thứ khác giữ nguyên v2:
-- idempotency, paid_at/business_date (VĐ1), v_method, INSERT, sync, audit_log.

DROP FUNCTION IF EXISTS public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE);

CREATE FUNCTION public.commit_payment(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_note TEXT,
  p_business_date DATE
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

  -- Only the three allowed methods survive; anything else becomes NULL.
  v_method := CASE
    WHEN NULLIF(btrim(p_method), '') IN ('cash', 'bank_transfer', 'other')
      THEN btrim(p_method)
    ELSE NULL
  END;

  INSERT INTO public.payments (
    owner_id, customer_id, amount, method, raw_input, idempotency_key, paid_at
  ) VALUES (
    v_owner, p_customer_id, p_amount, v_method, p_note, p_idempotency_key, v_paid_at
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
REVOKE ALL ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT, DATE) TO authenticated;
