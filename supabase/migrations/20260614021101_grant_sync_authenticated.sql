-- D3b: synchronize authenticated grants to the existing least-privilege design.
-- Forward-only; does not modify anon, service_role, RLS, or policies.

REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

REVOKE ALL ON TABLE
  public.customers, public.products, public.suppliers,
  public.orders, public.order_items, public.payments,
  public.purchases, public.purchase_items,
  public.chat_messages, public.pending_previews
FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customers, public.products, public.suppliers,
  public.orders, public.order_items, public.payments,
  public.purchases, public.purchase_items,
  public.chat_messages, public.pending_previews
TO authenticated;

REVOKE ALL ON TABLE
  public.inventory_movements,
  public.audit_log,
  public.usage_events
FROM authenticated;

GRANT SELECT, INSERT ON TABLE
  public.inventory_movements,
  public.audit_log,
  public.usage_events
TO authenticated;

REVOKE ALL ON TABLE public.ai_interactions FROM authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.ai_interactions
  TO authenticated;

REVOKE ALL ON TABLE
  public.v_customer_balances,
  public.v_inventory_status,
  public.v_daily_sales,
  public.v_usage_daily
FROM authenticated;

GRANT SELECT ON TABLE
  public.v_customer_balances,
  public.v_inventory_status,
  public.v_daily_sales,
  public.v_usage_daily
TO authenticated;
