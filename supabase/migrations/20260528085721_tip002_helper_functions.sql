-- TIP-002: Helper functions and invariant triggers only.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_update_delete_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_customer_debt_total(
  p_owner_id UUID,
  p_customer_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_debt NUMERIC(14,0);
BEGIN
  SELECT
    COALESCE((
      SELECT sum(o.debt_amount)
      FROM public.orders o
      WHERE o.owner_id = p_owner_id
        AND o.customer_id = p_customer_id
        AND o.status = 'confirmed'
        AND o.deleted_at IS NULL
    ), 0)
    -
    COALESCE((
      SELECT sum(p.amount)
      FROM public.payments p
      WHERE p.owner_id = p_owner_id
        AND p.customer_id = p_customer_id
        AND p.deleted_at IS NULL
    ), 0)
  INTO v_debt;

  UPDATE public.customers c
  SET debt_total = v_debt
  WHERE c.owner_id = p_owner_id
    AND c.id = p_customer_id;

  RETURN v_debt;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_current_stock(
  p_owner_id UUID,
  p_product_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stock NUMERIC(14,2);
BEGIN
  SELECT COALESCE(sum(im.quantity_delta), 0)::NUMERIC(14,2)
  INTO v_stock
  FROM public.inventory_movements im
  WHERE im.owner_id = p_owner_id
    AND im.product_id = p_product_id;

  UPDATE public.products p
  SET current_stock = v_stock
  WHERE p.owner_id = p_owner_id
    AND p.id = p_product_id;

  RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_pending_previews()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.pending_previews
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_order_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'orders.customer_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_order_item_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = NEW.order_id
      AND o.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'order_items.order_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'order_items.product_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_purchase_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.suppliers s
    WHERE s.id = NEW.supplier_id
      AND s.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'purchases.supplier_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_purchase_item_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.purchases p
    WHERE p.id = NEW.purchase_id
      AND p.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'purchase_items.purchase_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'purchase_items.product_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_payment_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = NEW.customer_id
      AND c.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'payments.customer_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = NEW.order_id
      AND o.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'payments.order_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_inventory_movement_same_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = NEW.product_id
      AND p.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'inventory_movements.product_id must belong to the same owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_order_items_updated_at ON public.order_items;
CREATE TRIGGER set_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;
CREATE TRIGGER set_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_purchases_updated_at ON public.purchases;
CREATE TRIGGER set_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_purchase_items_updated_at ON public.purchase_items;
CREATE TRIGGER set_purchase_items_updated_at
BEFORE UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_pending_previews_updated_at ON public.pending_previews;
CREATE TRIGGER set_pending_previews_updated_at
BEFORE UPDATE ON public.pending_previews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS prevent_inventory_movements_mutation ON public.inventory_movements;
CREATE TRIGGER prevent_inventory_movements_mutation
BEFORE UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_delete_immutable();

DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON public.audit_log;
CREATE TRIGGER prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_delete_immutable();

DROP TRIGGER IF EXISTS prevent_usage_events_mutation ON public.usage_events;
CREATE TRIGGER prevent_usage_events_mutation
BEFORE UPDATE OR DELETE ON public.usage_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_update_delete_immutable();

DROP TRIGGER IF EXISTS assert_orders_same_owner ON public.orders;
CREATE TRIGGER assert_orders_same_owner
BEFORE INSERT OR UPDATE OF owner_id, customer_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assert_order_same_owner();

DROP TRIGGER IF EXISTS assert_order_items_same_owner ON public.order_items;
CREATE TRIGGER assert_order_items_same_owner
BEFORE INSERT OR UPDATE OF owner_id, order_id, product_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.assert_order_item_same_owner();

DROP TRIGGER IF EXISTS assert_purchases_same_owner ON public.purchases;
CREATE TRIGGER assert_purchases_same_owner
BEFORE INSERT OR UPDATE OF owner_id, supplier_id ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_same_owner();

DROP TRIGGER IF EXISTS assert_purchase_items_same_owner ON public.purchase_items;
CREATE TRIGGER assert_purchase_items_same_owner
BEFORE INSERT OR UPDATE OF owner_id, purchase_id, product_id ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.assert_purchase_item_same_owner();

DROP TRIGGER IF EXISTS assert_payments_same_owner ON public.payments;
CREATE TRIGGER assert_payments_same_owner
BEFORE INSERT OR UPDATE OF owner_id, customer_id, order_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.assert_payment_same_owner();

DROP TRIGGER IF EXISTS assert_inventory_movements_same_owner ON public.inventory_movements;
CREATE TRIGGER assert_inventory_movements_same_owner
BEFORE INSERT OR UPDATE OF owner_id, product_id ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.assert_inventory_movement_same_owner();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_update_delete_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_order_same_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_order_item_same_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_purchase_same_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_purchase_item_same_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_payment_same_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_inventory_movement_same_owner() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_customer_debt_total(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_product_current_stock(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.expire_pending_previews() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sync_customer_debt_total(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_product_current_stock(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_previews() TO authenticated, service_role;
