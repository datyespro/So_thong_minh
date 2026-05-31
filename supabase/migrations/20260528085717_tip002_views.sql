-- TIP-002: Reporting/query views. security_invoker keeps base-table RLS active.

CREATE OR REPLACE VIEW public.v_customer_balances
WITH (security_invoker = true) AS
SELECT
  c.owner_id,
  c.id AS customer_id,
  c.name AS customer_name,
  c.phone,
  c.debt_total,
  last_order.last_order_at,
  last_payment.last_payment_at
FROM public.customers c
LEFT JOIN LATERAL (
  SELECT max(o.created_at) AS last_order_at
  FROM public.orders o
  WHERE o.owner_id = c.owner_id
    AND o.customer_id = c.id
    AND o.status = 'confirmed'
    AND o.deleted_at IS NULL
) last_order ON true
LEFT JOIN LATERAL (
  SELECT max(p.paid_at) AS last_payment_at
  FROM public.payments p
  WHERE p.owner_id = c.owner_id
    AND p.customer_id = c.id
    AND p.deleted_at IS NULL
) last_payment ON true
WHERE c.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_inventory_status
WITH (security_invoker = true) AS
SELECT
  p.owner_id,
  p.id AS product_id,
  p.name AS product_name,
  p.unit,
  p.current_stock,
  p.min_stock,
  CASE
    WHEN p.min_stock IS NOT NULL AND p.current_stock <= p.min_stock THEN 'low'
    ELSE 'ok'
  END AS stock_status,
  last_movement.last_movement_at
FROM public.products p
LEFT JOIN LATERAL (
  SELECT max(im.created_at) AS last_movement_at
  FROM public.inventory_movements im
  WHERE im.owner_id = p.owner_id
    AND im.product_id = p.id
) last_movement ON true
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_daily_sales
WITH (security_invoker = true) AS
SELECT
  o.owner_id,
  o.business_date,
  count(*)::BIGINT AS orders_count,
  coalesce(sum(o.total_amount), 0)::NUMERIC(14,0) AS total_revenue,
  coalesce(sum(o.paid_amount), 0)::NUMERIC(14,0) AS total_paid,
  coalesce(sum(o.debt_amount), 0)::NUMERIC(14,0) AS total_debt
FROM public.orders o
WHERE o.status = 'confirmed'
  AND o.deleted_at IS NULL
GROUP BY o.owner_id, o.business_date;

CREATE OR REPLACE VIEW public.v_usage_daily
WITH (security_invoker = true) AS
SELECT
  ue.owner_id,
  date_trunc('day', ue.created_at)::DATE AS day,
  count(*) FILTER (WHERE ue.event_type = 'login')::BIGINT AS login_count,
  count(*) FILTER (WHERE ue.event_type = 'order_created')::BIGINT AS order_created_count,
  count(*) FILTER (WHERE ue.event_type = 'order_edited')::BIGINT AS order_edited_count,
  count(*) FILTER (WHERE ue.event_type = 'payment_created')::BIGINT AS payment_created_count,
  count(*) FILTER (WHERE ue.event_type = 'query')::BIGINT AS query_count,
  count(*) FILTER (WHERE ue.event_type = 'undo')::BIGINT AS undo_count,
  count(*)::BIGINT AS active_events_count
FROM public.usage_events ue
GROUP BY ue.owner_id, date_trunc('day', ue.created_at)::DATE;

REVOKE ALL ON TABLE
  public.v_customer_balances,
  public.v_inventory_status,
  public.v_daily_sales,
  public.v_usage_daily
FROM anon;

GRANT SELECT ON TABLE
  public.v_customer_balances,
  public.v_inventory_status,
  public.v_daily_sales,
  public.v_usage_daily
TO authenticated, service_role;
