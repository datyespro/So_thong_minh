-- TIP-007c: Undo a just-committed order / payment / purchase.
--
-- The ledger is append-only by convention: undo NEVER hard-deletes or edits the
-- original amounts. It marks the original as cancelled (orders/purchases -> status
-- 'voided'; payments -> soft-delete deleted_at) and writes a COMPENSATING entry,
-- then lets the recompute-from-source sync_* functions fix denorm.
--
-- Confirmed by 007-PROBE / 007a-b:
--   * sync_customer_debt_total sums orders WHERE status='confirmed' AND deleted_at IS NULL
--     minus payments WHERE deleted_at IS NULL -> voiding an order or soft-deleting a
--     payment makes the recompute drop it automatically.
--   * sync_product_current_stock sums ALL inventory_movements -> a +/- 'undo' movement
--     cancels the original sale/purchase movement.
--   * orders/payments/purchases have no prevent-mutation trigger; the assert_*_same_owner
--     triggers only fire on UPDATE OF owner/customer/order columns, not status/deleted_at.
--
-- IDEMPOTENCY (critical): each original can be undone exactly once. The atomic guard is
-- a single UPDATE ... WHERE <still active> RETURNING: only the first call flips the row,
-- a second call updates nothing and returns "already_undone" without writing again.
-- The whole body is one transaction -> any error rolls back cleanly (no half-undo).

-- ===========================================================================
-- undo_order: reverse a sale. Goods return to stock (+qty), debt drops (voided).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.undo_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_customer UUID;
  v_status TEXT;
  v_new_debt NUMERIC(14,0);
  v_item RECORD;
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_pid UUID;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  -- Atomic idempotency guard: only a confirmed order flips to voided.
  UPDATE public.orders
  SET status = 'voided'
  WHERE id = p_order_id AND owner_id = v_owner
    AND status = 'confirmed' AND deleted_at IS NULL
  RETURNING customer_id INTO v_customer;

  IF NOT FOUND THEN
    SELECT status, customer_id INTO v_status, v_customer
    FROM public.orders WHERE id = p_order_id AND owner_id = v_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'order not found for this owner' USING ERRCODE = '23503';
    END IF;
    -- Already voided -> idempotent no-op.
    SELECT debt_total INTO v_new_debt
    FROM public.customers WHERE id = v_customer AND owner_id = v_owner;
    RETURN jsonb_build_object(
      'order_id', p_order_id, 'status', v_status,
      'new_debt_total', v_new_debt, 'already_undone', true
    );
  END IF;

  -- Compensating movements: +qty returns each sold item to stock.
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.order_items
    WHERE order_id = p_order_id AND owner_id = v_owner
      AND product_id IS NOT NULL AND deleted_at IS NULL
  LOOP
    INSERT INTO public.inventory_movements (
      owner_id, product_id, movement_type, quantity_delta, source_type, source_id, created_by
    ) VALUES (
      v_owner, v_item.product_id, 'undo', v_item.quantity, 'undo', p_order_id, v_owner
    );
    IF NOT (v_item.product_id = ANY (v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_item.product_id);
    END IF;
  END LOOP;

  FOREACH v_pid IN ARRAY v_product_ids
  LOOP
    PERFORM public.sync_product_current_stock(v_owner, v_pid);
  END LOOP;

  IF v_customer IS NOT NULL THEN
    PERFORM public.sync_customer_debt_total(v_owner, v_customer);
    SELECT debt_total INTO v_new_debt
    FROM public.customers WHERE id = v_customer AND owner_id = v_owner;
  END IF;

  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'order', p_order_id, 'undo');

  RETURN jsonb_build_object(
    'order_id', p_order_id, 'status', 'voided',
    'new_debt_total', v_new_debt, 'already_undone', false
  );
END;
$$;

-- ===========================================================================
-- undo_payment: cancel a payment (soft-delete). Debt rises back.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.undo_payment(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_customer UUID;
  v_new_debt NUMERIC(14,0);
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  -- Atomic idempotency guard: only a live payment soft-deletes.
  UPDATE public.payments
  SET deleted_at = now()
  WHERE id = p_payment_id AND owner_id = v_owner AND deleted_at IS NULL
  RETURNING customer_id INTO v_customer;

  IF NOT FOUND THEN
    SELECT customer_id INTO v_customer
    FROM public.payments WHERE id = p_payment_id AND owner_id = v_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment not found for this owner' USING ERRCODE = '23503';
    END IF;
    SELECT debt_total INTO v_new_debt
    FROM public.customers WHERE id = v_customer AND owner_id = v_owner;
    RETURN jsonb_build_object(
      'payment_id', p_payment_id, 'new_debt_total', v_new_debt, 'already_undone', true
    );
  END IF;

  PERFORM public.sync_customer_debt_total(v_owner, v_customer);
  SELECT debt_total INTO v_new_debt
  FROM public.customers WHERE id = v_customer AND owner_id = v_owner;

  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'payment', p_payment_id, 'undo');

  RETURN jsonb_build_object(
    'payment_id', p_payment_id, 'new_debt_total', v_new_debt, 'already_undone', false
  );
END;
$$;

-- ===========================================================================
-- undo_purchase: reverse a purchase. Stock drops (-qty); may go negative (allowed).
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.undo_purchase(p_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner UUID := auth.uid();
  v_status TEXT;
  v_check UUID;
  v_item RECORD;
  v_product_ids UUID[] := ARRAY[]::UUID[];
  v_pid UUID;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'unauthorized: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  UPDATE public.purchases
  SET status = 'voided'
  WHERE id = p_purchase_id AND owner_id = v_owner
    AND status = 'confirmed' AND deleted_at IS NULL
  RETURNING id INTO v_check;

  IF NOT FOUND THEN
    SELECT status INTO v_status
    FROM public.purchases WHERE id = p_purchase_id AND owner_id = v_owner;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'purchase not found for this owner' USING ERRCODE = '23503';
    END IF;
    RETURN jsonb_build_object(
      'purchase_id', p_purchase_id, 'status', v_status, 'already_undone', true
    );
  END IF;

  -- Compensating movements: -qty removes each purchased item from stock.
  FOR v_item IN
    SELECT product_id, quantity
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id AND owner_id = v_owner
      AND product_id IS NOT NULL AND deleted_at IS NULL
  LOOP
    INSERT INTO public.inventory_movements (
      owner_id, product_id, movement_type, quantity_delta, source_type, source_id, created_by
    ) VALUES (
      v_owner, v_item.product_id, 'undo', -v_item.quantity, 'undo', p_purchase_id, v_owner
    );
    IF NOT (v_item.product_id = ANY (v_product_ids)) THEN
      v_product_ids := array_append(v_product_ids, v_item.product_id);
    END IF;
  END LOOP;

  FOREACH v_pid IN ARRAY v_product_ids
  LOOP
    PERFORM public.sync_product_current_stock(v_owner, v_pid);
  END LOOP;

  INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
  VALUES (v_owner, v_owner, 'purchase', p_purchase_id, 'undo');

  RETURN jsonb_build_object(
    'purchase_id', p_purchase_id, 'status', 'voided', 'already_undone', false
  );
END;
$$;

-- Authenticated end users only (least-privilege, matching 007a/b). Never anon/public.
REVOKE ALL ON FUNCTION public.undo_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.undo_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_payment(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.undo_purchase(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_purchase(UUID) TO authenticated;
