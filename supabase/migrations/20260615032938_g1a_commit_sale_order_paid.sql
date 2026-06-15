-- G1a: commit_sale_order v2 — hỗ trợ trả ngay một phần khi mua.
-- Thêm p_paid_amount (DEFAULT 0 = tương thích ngược). debt = total - paid.
-- Đổi signature → DROP hàm 5-tham-số cũ rồi CREATE bản 6-tham-số.

DROP FUNCTION IF EXISTS public.commit_sale_order(TEXT, UUID, DATE, TEXT, JSONB);

CREATE FUNCTION public.commit_sale_order(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_business_date DATE,
  p_note TEXT,
  p_items JSONB,
  p_paid_amount NUMERIC(14,0) DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_order_id UUID;
  v_total NUMERIC(14,0) := 0;
  v_paid NUMERIC(14,0) := 0;
  v_debt NUMERIC(14,0) := 0;
  v_existing_id UUID;
  v_existing_total NUMERIC(14,0);
  v_existing_paid NUMERIC(14,0);
  v_existing_debt NUMERIC(14,0);
  v_item JSONB;
  v_idx INTEGER := 0;
  v_pid UUID;
  v_qty NUMERIC;
  v_price NUMERIC;
  v_product_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- 1. Authn
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_id is required' USING ERRCODE = '23502';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty JSON array' USING ERRCODE = '22023';
  END IF;

  -- 2. Idempotency fast path (trả lại nguyên trạng + paid).
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, total_amount, paid_amount, debt_amount
      INTO v_existing_id, v_existing_total, v_existing_paid, v_existing_debt
    FROM public.orders
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing_id,
        'total_amount', v_existing_total,
        'paid_amount', v_existing_paid,
        'debt_amount', v_existing_debt,
        'idempotent_reuse', true
      );
    END IF;
  END IF;

  -- 3. Validate items + compute total IN SQL.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item ->> 'product_id') IS NULL THEN
      RAISE EXCEPTION 'every item must have a product_id (unresolved products cannot be committed)'
        USING ERRCODE = '23502';
    END IF;
    v_qty := NULLIF(v_item ->> 'quantity', '')::NUMERIC;
    v_price := NULLIF(v_item ->> 'unit_price', '')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'item quantity must be a positive number' USING ERRCODE = '22023';
    END IF;
    IF v_price IS NULL OR v_price < 0 THEN
      RAISE EXCEPTION 'item unit_price must be a number >= 0' USING ERRCODE = '22023';
    END IF;
    v_total := v_total + (v_qty * v_price);
  END LOOP;

  -- 3b. Trả ngay: chốt paid + debt. Guard nghiêm (validator là cổng thân thiện ở G1b).
  v_paid := COALESCE(p_paid_amount, 0);
  IF v_paid < 0 THEN
    RAISE EXCEPTION 'paid_amount must be >= 0' USING ERRCODE = '22023';
  END IF;
  IF v_paid > v_total THEN
    RAISE EXCEPTION 'paid_amount (%) exceeds order total (%)', v_paid, v_total USING ERRCODE = '22023';
  END IF;
  v_debt := v_total - v_paid;

  -- 4 + 5. Insert order. debt = total - paid.
  INSERT INTO public.orders (
    owner_id, customer_id, business_date, status,
    total_amount, paid_amount, debt_amount, raw_input, idempotency_key
  ) VALUES (
    v_owner, p_customer_id,
    COALESCE(p_business_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE),
    'confirmed',
    v_total, v_paid, v_debt,
    p_note, p_idempotency_key
  )
  ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    SELECT id, total_amount, paid_amount, debt_amount
      INTO v_existing_id, v_existing_total, v_existing_paid, v_existing_debt
    FROM public.orders
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;
    RETURN jsonb_build_object(
      'order_id', v_existing_id,
      'total_amount', v_existing_total,
      'paid_amount', v_existing_paid,
      'debt_amount', v_existing_debt,
      'idempotent_reuse', true
    );
  END IF;

  -- 6 + 7. Items + sale movements (negative delta).
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (v_item ->> 'product_id')::UUID;
    v_qty := (v_item ->> 'quantity')::NUMERIC;
    v_price := (v_item ->> 'unit_price')::NUMERIC;
    INSERT INTO public.order_items (
      owner_id, order_id, product_id, product_name_snapshot, unit_snapshot,
      quantity, unit_price, line_total, sort_order
    ) VALUES (
      v_owner, v_order_id, v_pid,
      COALESCE(NULLIF(btrim(v_item ->> 'product_name_snapshot'), ''),
               (SELECT name FROM public.products WHERE id = v_pid AND owner_id = v_owner),
               'Hàng'),
      NULLIF(btrim(v_item ->> 'unit_snapshot'), ''),
      v_qty, v_price, v_qty * v_price, v_idx
    );
    INSERT INTO public.inventory_movements (
      owner_id, product_id, movement_type, quantity_delta, source_type, source_id, created_by
    ) VALUES (
      v_owner, v_pid, 'sale', -v_qty, 'order', v_order_id, v_owner
    );
    IF NOT (v_pid = ANY (v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_pid);
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- 8 + 9. Recompute denorm.
  FOREACH v_pid IN ARRAY v_product_ids LOOP
    PERFORM public.sync_product_current_stock(v_owner, v_pid);
  END LOOP;
  PERFORM public.sync_customer_debt_total(v_owner, p_customer_id);

  -- 10. Audit (append-only).
  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'order', v_order_id, 'create');

  -- 11. Return.
  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'total_amount', v_total,
    'paid_amount', v_paid,
    'debt_amount', v_debt,
    'idempotent_reuse', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_sale_order(TEXT, UUID, DATE, TEXT, JSONB, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_sale_order(TEXT, UUID, DATE, TEXT, JSONB, NUMERIC) TO authenticated;
