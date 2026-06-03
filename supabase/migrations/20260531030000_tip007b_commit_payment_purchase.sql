-- TIP-007b: Atomic commit for record_payment + create_purchase.
--
-- Same shape as 007a's commit_sale_order: one PL/pgSQL function per intent, one
-- atomic transaction, SECURITY INVOKER (RLS scopes every write to auth.uid()),
-- money recomputed in SQL, idempotency via the (owner_id, idempotency_key) index,
-- denorm refreshed by the sync_* functions (recompute-from-source, called once).
--
-- Confirmed by 007-PROBE / 007a:
--   * payments: amount NN (>0), customer_id NN, no business_date (paid_at d now()).
--   * purchases: total_amount NN, supplier_id NULLABLE, business_date from caller.
--   * purchase_items: unit_cost NULLABLE -> we REQUIRE it (a purchase needs a cost).
--   * inventory_movements: manual insert; purchase = POSITIVE delta.
--   * No supplier-debt sync exists -> purchase does not touch any debt (MVP).

-- ---------------------------------------------------------------------------
-- usage_events telemetry: 'payment_created' already allowed; add 'purchase_created'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.usage_events DROP CONSTRAINT usage_events_type_check;
ALTER TABLE public.usage_events ADD CONSTRAINT usage_events_type_check
  CHECK (event_type = ANY (ARRAY[
    'login', 'order_created', 'order_edited', 'payment_created',
    'purchase_created', 'query', 'undo'
  ]));

-- ===========================================================================
-- FUNCTION 1 — commit_payment (record_payment). Overpayment is BLOCKED (plan B).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.commit_payment(
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_note TEXT
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
  v_debt NUMERIC(14,0);
  v_new_debt NUMERIC(14,0);
  v_method TEXT;
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

  -- Idempotency fast path.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, amount INTO v_existing_id, v_existing_amount
    FROM public.payments
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'payment_id', v_existing_id,
        'amount', v_existing_amount,
        'new_debt_total', (SELECT debt_total FROM public.customers WHERE id = p_customer_id AND owner_id = v_owner),
        'idempotent_reuse', true
      );
    END IF;
  END IF;

  -- Plan B: read current debt authoritatively and BLOCK an overpayment, even if
  -- the debt changed between the time the card was shown and now.
  SELECT debt_total INTO v_debt
  FROM public.customers
  WHERE id = p_customer_id AND owner_id = v_owner;

  IF v_debt IS NULL THEN
    RAISE EXCEPTION 'customer not found for this owner' USING ERRCODE = '23503';
  END IF;
  IF p_amount > v_debt THEN
    RAISE EXCEPTION 'payment % exceeds current debt %', p_amount, v_debt USING ERRCODE = '23514';
  END IF;

  -- Only the three allowed methods survive; anything else becomes NULL.
  v_method := CASE
    WHEN NULLIF(btrim(p_method), '') IN ('cash', 'bank_transfer', 'other')
      THEN btrim(p_method)
    ELSE NULL
  END;

  INSERT INTO public.payments (
    owner_id, customer_id, amount, method, raw_input, idempotency_key
  ) VALUES (
    v_owner, p_customer_id, p_amount, v_method, p_note, p_idempotency_key
  )
  ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_payment_id;

  IF v_payment_id IS NULL THEN
    SELECT id, amount INTO v_existing_id, v_existing_amount
    FROM public.payments
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
      'payment_id', v_existing_id,
      'amount', v_existing_amount,
      'new_debt_total', (SELECT debt_total FROM public.customers WHERE id = p_customer_id AND owner_id = v_owner),
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
    'idempotent_reuse', false
  );
END;
$$;

-- ===========================================================================
-- FUNCTION 2 — commit_purchase (create_purchase). Mirror of 007a, sign flipped.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.commit_purchase(
  p_idempotency_key TEXT,
  p_supplier_id UUID,
  p_business_date DATE,
  p_note TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_purchase_id UUID;
  v_total NUMERIC(14,0) := 0;
  v_existing_id UUID;
  v_existing_total NUMERIC(14,0);
  v_item JSONB;
  v_idx INTEGER := 0;
  v_pid UUID;
  v_qty NUMERIC;
  v_cost NUMERIC;
  v_product_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty JSON array' USING ERRCODE = '22023';
  END IF;

  -- Idempotency fast path.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, total_amount INTO v_existing_id, v_existing_total
    FROM public.purchases
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'purchase_id', v_existing_id,
        'total_amount', v_existing_total,
        'idempotent_reuse', true
      );
    END IF;
  END IF;

  -- Validate items + compute total IN SQL. unit_cost is REQUIRED for a purchase.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item ->> 'product_id') IS NULL THEN
      RAISE EXCEPTION 'every item must have a product_id (unresolved products cannot be committed)'
        USING ERRCODE = '23502';
    END IF;

    v_qty := NULLIF(v_item ->> 'quantity', '')::NUMERIC;
    v_cost := NULLIF(v_item ->> 'unit_cost', '')::NUMERIC;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'item quantity must be a positive number' USING ERRCODE = '22023';
    END IF;
    IF v_cost IS NULL THEN
      RAISE EXCEPTION 'item unit_cost is required for a purchase' USING ERRCODE = '22023';
    END IF;
    IF v_cost < 0 THEN
      RAISE EXCEPTION 'item unit_cost must be a number >= 0' USING ERRCODE = '22023';
    END IF;

    v_total := v_total + (v_qty * v_cost);
  END LOOP;

  -- Insert the purchase (parent first). supplier_id may be NULL (purchase w/o supplier).
  INSERT INTO public.purchases (
    owner_id, supplier_id, business_date, status, total_amount, raw_input, idempotency_key
  ) VALUES (
    v_owner,
    p_supplier_id,
    COALESCE(p_business_date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE),
    'confirmed',
    v_total,
    p_note,
    p_idempotency_key
  )
  ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_purchase_id;

  IF v_purchase_id IS NULL THEN
    SELECT id, total_amount INTO v_existing_id, v_existing_total
    FROM public.purchases
    WHERE owner_id = v_owner AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
      'purchase_id', v_existing_id,
      'total_amount', v_existing_total,
      'idempotent_reuse', true
    );
  END IF;

  -- Items + a purchase movement (POSITIVE delta) per item.
  v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (v_item ->> 'product_id')::UUID;
    v_qty := (v_item ->> 'quantity')::NUMERIC;
    v_cost := (v_item ->> 'unit_cost')::NUMERIC;

    INSERT INTO public.purchase_items (
      owner_id, purchase_id, product_id,
      product_name_snapshot, unit_snapshot,
      quantity, unit_cost, line_total, sort_order
    ) VALUES (
      v_owner, v_purchase_id, v_pid,
      COALESCE(
        NULLIF(btrim(v_item ->> 'product_name_snapshot'), ''),
        (SELECT name FROM public.products WHERE id = v_pid AND owner_id = v_owner),
        'Hàng'
      ),
      NULLIF(btrim(v_item ->> 'unit_snapshot'), ''),
      v_qty, v_cost, v_qty * v_cost, v_idx
    );

    INSERT INTO public.inventory_movements (
      owner_id, product_id, movement_type, quantity_delta,
      source_type, source_id, created_by
    ) VALUES (
      v_owner, v_pid, 'purchase', v_qty,
      'purchase', v_purchase_id, v_owner
    );

    IF NOT (v_pid = ANY (v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_pid);
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  -- Recompute stock once per distinct product (no supplier debt to sync).
  FOREACH v_pid IN ARRAY v_product_ids
  LOOP
    PERFORM public.sync_product_current_stock(v_owner, v_pid);
  END LOOP;

  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'purchase', v_purchase_id, 'create');

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'total_amount', v_total,
    'idempotent_reuse', false
  );
END;
$$;

-- Authenticated end users only (least-privilege, matching 007a). Never anon/public.
REVOKE ALL ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_payment(TEXT, UUID, NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.commit_purchase(TEXT, UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_purchase(TEXT, UUID, DATE, TEXT, JSONB) TO authenticated;
