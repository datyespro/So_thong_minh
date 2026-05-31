BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'TIP-002 verification failed: %', p_message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  (
    SELECT count(*) = 14
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relkind = 'r'
  ),
  'public schema should contain exactly 14 domain tables'
);

WITH expected(table_name) AS (
  VALUES
    ('profiles'),
    ('customers'),
    ('products'),
    ('suppliers'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('purchases'),
    ('purchase_items'),
    ('inventory_movements'),
    ('audit_log'),
    ('chat_messages'),
    ('pending_previews'),
    ('usage_events')
)
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected e
    WHERE to_regclass('public.' || e.table_name) IS NULL
  ),
  'all 14 expected tables should exist'
);

WITH expected(table_name) AS (
  VALUES
    ('profiles'),
    ('customers'),
    ('products'),
    ('suppliers'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('purchases'),
    ('purchase_items'),
    ('inventory_movements'),
    ('audit_log'),
    ('chat_messages'),
    ('pending_previews'),
    ('usage_events')
)
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected e
    JOIN pg_class c ON c.oid = ('public.' || e.table_name)::regclass
    WHERE NOT c.relrowsecurity
  ),
  'RLS should be enabled on every TIP-002 table'
);

WITH expected(view_name) AS (
  VALUES
    ('v_customer_balances'),
    ('v_inventory_status'),
    ('v_daily_sales'),
    ('v_usage_daily')
)
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected e
    JOIN pg_class c ON c.oid = ('public.' || e.view_name)::regclass
    WHERE c.relkind <> 'v'
       OR NOT (COALESCE(c.reloptions, '{}'::TEXT[]) @> ARRAY['security_invoker=true'])
  ),
  'all required views should exist and use security_invoker=true'
);

SELECT pg_temp.assert_true(to_regprocedure('public.set_updated_at()') IS NOT NULL, 'set_updated_at should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.prevent_update_delete_immutable()') IS NOT NULL, 'prevent_update_delete_immutable should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.sync_customer_debt_total(uuid,uuid)') IS NOT NULL, 'sync_customer_debt_total should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.sync_product_current_stock(uuid,uuid)') IS NOT NULL, 'sync_product_current_stock should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.expire_pending_previews()') IS NOT NULL, 'expire_pending_previews should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.assert_order_item_same_owner()') IS NOT NULL, 'order item owner trigger function should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.assert_purchase_item_same_owner()') IS NOT NULL, 'purchase item owner trigger function should exist');
SELECT pg_temp.assert_true(to_regprocedure('public.assert_payment_same_owner()') IS NOT NULL, 'payment owner trigger function should exist');

WITH expected(index_name) AS (
  VALUES
    ('customers_owner_active_name_uidx'),
    ('customers_owner_debt_total_idx'),
    ('customers_aliases_gin_idx'),
    ('products_owner_active_name_uidx'),
    ('products_owner_current_stock_idx'),
    ('products_aliases_gin_idx'),
    ('orders_owner_business_date_idx'),
    ('orders_owner_customer_business_date_idx'),
    ('orders_owner_idempotency_key_uidx'),
    ('payments_owner_customer_paid_at_idx'),
    ('payments_owner_idempotency_key_uidx'),
    ('purchases_owner_business_date_idx'),
    ('purchases_owner_idempotency_key_uidx'),
    ('inventory_movements_owner_product_created_idx'),
    ('audit_log_owner_created_idx'),
    ('audit_log_metadata_gin_idx'),
    ('chat_messages_owner_created_idx'),
    ('pending_previews_owner_status_expires_idx'),
    ('pending_previews_owner_idempotency_key_uidx'),
    ('usage_events_owner_type_created_idx')
)
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM expected e
    WHERE to_regclass('public.' || e.index_name) IS NULL
  ),
  'critical indexes should exist'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('inventory_movements', 'audit_log', 'usage_events')
      AND cmd IN ('UPDATE', 'DELETE')
  ),
  'append-only tables should not have UPDATE or DELETE policies'
);

SELECT pg_temp.assert_true(
  (
    SELECT array_agg(column_name::TEXT ORDER BY ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usage_events'
  ) = ARRAY['id', 'owner_id', 'event_type', 'created_at'],
  'usage_events should contain only id, owner_id, event_type, created_at'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usage_events'
      AND column_name IN ('content', 'raw_input', 'message', 'payload', 'metadata')
  ),
  'usage_events should not store content or metadata columns'
);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  is_sso_user,
  is_anonymous
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'tip002-a@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi7d5k7uvmb0xYwYmTHQsnP77QJY1Yi',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    '{"name":"TIP002 A"}'::JSONB,
    false,
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'tip002-b@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi7d5k7uvmb0xYwYmTHQsnP77QJY1Yi',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    '{"name":"TIP002 B"}'::JSONB,
    false,
    false,
    false
  );

INSERT INTO public.customers (id, owner_id, name)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Customer A'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Customer B');

INSERT INTO public.products (id, owner_id, name, unit)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Product A', 'cái'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Product B', 'cái');

INSERT INTO public.orders (
  id,
  owner_id,
  customer_id,
  business_date,
  status,
  total_amount,
  paid_amount,
  debt_amount
)
VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    current_date,
    'confirmed',
    100000,
    0,
    100000
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    current_date,
    'confirmed',
    50000,
    50000,
    0
  );

INSERT INTO public.payments (
  id,
  owner_id,
  customer_id,
  order_id,
  amount
)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  30000
);

INSERT INTO public.inventory_movements (
  id,
  owner_id,
  product_id,
  movement_type,
  quantity_delta,
  source_type,
  created_by
)
VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'purchase',
    10,
    'manual',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'sale',
    -3,
    'order',
    '10000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.audit_log (id, owner_id, actor_id, entity_type, entity_id, action)
VALUES (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'order',
  '40000000-0000-0000-0000-000000000001',
  'created'
);

INSERT INTO public.pending_previews (
  id,
  owner_id,
  preview_type,
  status,
  payload,
  expires_at
)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'order',
  'pending',
  '{"items":[]}'::JSONB,
  now() - interval '5 minutes'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.customers) = 1,
  'owner A should only read owner A customers'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.customers
    WHERE owner_id = '10000000-0000-0000-0000-000000000002'
  ),
  'owner A should not read owner B customers'
);

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.products (owner_id, name)
    VALUES ('10000000-0000-0000-0000-000000000002', 'Forbidden product');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: owner A inserted a product for owner B';
  END IF;
END;
$$;

INSERT INTO public.usage_events (owner_id, event_type)
VALUES ('10000000-0000-0000-0000-000000000001', 'login');

SELECT pg_temp.assert_true(
  (
    SELECT count(*)
    FROM public.usage_events
    WHERE event_type = 'login'
  ) = 1,
  'owner A should insert and select own usage_events'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM public.v_daily_sales
    WHERE owner_id = '10000000-0000-0000-0000-000000000002'
  ),
  'v_daily_sales should not leak owner B data to owner A'
);

RESET ROLE;

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.inventory_movements
    SET note = 'mutated'
    WHERE id = '60000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: inventory_movements UPDATE should be blocked';
  END IF;

  v_rejected := false;

  BEGIN
    DELETE FROM public.inventory_movements
    WHERE id = '60000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: inventory_movements DELETE should be blocked';
  END IF;
END;
$$;

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.audit_log
    SET metadata = '{"mutated":true}'::JSONB
    WHERE id = '70000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: audit_log UPDATE should be blocked';
  END IF;

  v_rejected := false;

  BEGIN
    DELETE FROM public.audit_log
    WHERE id = '70000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: audit_log DELETE should be blocked';
  END IF;
END;
$$;

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    UPDATE public.usage_events
    SET event_type = 'query'
    WHERE owner_id = '10000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: usage_events UPDATE should be blocked';
  END IF;
END;
$$;

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    INSERT INTO public.order_items (
      owner_id,
      order_id,
      product_id,
      product_name_snapshot,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002',
      'Cross owner product',
      1,
      1000,
      1000
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: cross-owner order_items row should be rejected';
  END IF;
END;
$$;

DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  INSERT INTO public.orders (
    id,
    owner_id,
    customer_id,
    status,
    total_amount,
    paid_amount,
    debt_amount,
    idempotency_key
  )
  VALUES (
    '40000000-0000-0000-0000-000000000011',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'confirmed',
    0,
    0,
    0,
    'abc'
  );

  BEGIN
    INSERT INTO public.orders (
      id,
      owner_id,
      customer_id,
      status,
      total_amount,
      paid_amount,
      debt_amount,
      idempotency_key
    )
    VALUES (
      '40000000-0000-0000-0000-000000000012',
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'confirmed',
      0,
      0,
      0,
      'abc'
    );
  EXCEPTION WHEN unique_violation THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 verification failed: duplicate owner idempotency key should be rejected';
  END IF;

  INSERT INTO public.orders (
    id,
    owner_id,
    customer_id,
    status,
    total_amount,
    paid_amount,
    debt_amount,
    idempotency_key
  )
  VALUES (
    '40000000-0000-0000-0000-000000000013',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'confirmed',
    0,
    0,
    0,
    'abc'
  );
END;
$$;

SELECT pg_temp.assert_true(
  public.sync_customer_debt_total(
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001'
  ) = 70000,
  'customer debt sync should return 70000'
);

SELECT pg_temp.assert_true(
  (
    SELECT debt_total
    FROM public.customers
    WHERE id = '20000000-0000-0000-0000-000000000001'
  ) = 70000,
  'customer debt_total should be 70000 after sync'
);

SELECT pg_temp.assert_true(
  public.sync_product_current_stock(
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001'
  ) = 7,
  'product stock sync should return 7'
);

SELECT pg_temp.assert_true(
  (
    SELECT current_stock
    FROM public.products
    WHERE id = '30000000-0000-0000-0000-000000000001'
  ) = 7,
  'product current_stock should be 7 after sync'
);

SELECT pg_temp.assert_true(
  public.expire_pending_previews() >= 1,
  'expire_pending_previews should expire at least one row'
);

SELECT pg_temp.assert_true(
  (
    SELECT status
    FROM public.pending_previews
    WHERE id = '80000000-0000-0000-0000-000000000001'
  ) = 'expired',
  'expired pending preview should have status expired'
);

ROLLBACK;
