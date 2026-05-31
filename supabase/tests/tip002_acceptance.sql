BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT COALESCE(p_condition, false) THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: %', p_message;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.use_test_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id::TEXT, 'role', 'authenticated')::TEXT,
    true
  );
END;
$$;

-- A. Schema existence
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
  'all 14 domain tables should exist'
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
  ),
  'all 4 reporting views should exist'
);

-- B. RLS
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
  'RLS should be enabled on all 14 domain tables'
);

-- C. View security
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
    WHERE NOT (COALESCE(c.reloptions, '{}'::TEXT[]) @> ARRAY['security_invoker=true'])
  ),
  'all 4 reporting views should use security_invoker=true'
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
    '11000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'tip002-acceptance-a@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi7d5k7uvmb0xYwYmTHQsnP77QJY1Yi',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    '{"name":"TIP002 Acceptance A"}'::JSONB,
    false,
    false,
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '11000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'tip002-acceptance-b@example.test',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi7d5k7uvmb0xYwYmTHQsnP77QJY1Yi',
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::JSONB,
    '{"name":"TIP002 Acceptance B"}'::JSONB,
    false,
    false,
    false
  );

INSERT INTO public.customers (id, owner_id, name)
VALUES
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Acceptance Customer A'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Acceptance Customer B'),
  ('21000000-0000-0000-0000-000000000011', '11000000-0000-0000-0000-000000000001', 'Debt Customer A');

INSERT INTO public.products (id, owner_id, name, unit)
VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Acceptance Product A', 'cái'),
  ('31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Acceptance Product B', 'cái'),
  ('31000000-0000-0000-0000-000000000011', '11000000-0000-0000-0000-000000000001', 'Stock Product A', 'cái');

INSERT INTO public.suppliers (id, owner_id, name)
VALUES
  ('32000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Acceptance Supplier A'),
  ('32000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Acceptance Supplier B');

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
    '41000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    current_date,
    'confirmed',
    100000,
    20000,
    80000
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000002',
    current_date,
    'confirmed',
    90000,
    90000,
    0
  ),
  (
    '41000000-0000-0000-0000-000000000011',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000011',
    current_date,
    'confirmed',
    500000,
    0,
    500000
  );

INSERT INTO public.payments (id, owner_id, customer_id, order_id, amount)
VALUES
  (
    '51000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    20000
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    90000
  ),
  (
    '51000000-0000-0000-0000-000000000011',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000011',
    '41000000-0000-0000-0000-000000000011',
    200000
  );

INSERT INTO public.purchases (id, owner_id, supplier_id, status, total_amount)
VALUES
  (
    '42000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'confirmed',
    100000
  ),
  (
    '42000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000002',
    'confirmed',
    100000
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
    '61000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    'purchase',
    5,
    'manual',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002',
    'purchase',
    7,
    'manual',
    '11000000-0000-0000-0000-000000000002'
  ),
  (
    '61000000-0000-0000-0000-000000000011',
    '11000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000011',
    'purchase',
    100,
    'manual',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '61000000-0000-0000-0000-000000000012',
    '11000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000011',
    'sale',
    -20,
    'manual',
    '11000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.usage_events (id, owner_id, event_type)
VALUES
  ('91000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'login'),
  ('91000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'query');

-- D. Multi-tenant isolation for User A, base tables and views.
SELECT pg_temp.use_test_user('11000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true((SELECT count(*) FROM public.customers WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own customers');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.customers WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B customers');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.products WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own products');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.products WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B products');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.orders WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own orders');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.orders WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B orders');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own payments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B payments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.usage_events WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 1, 'User A should see own usage events');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.usage_events WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B usage events');

SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_customer_balances WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own customer balance rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_customer_balances WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B customer balance rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_inventory_status WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 2, 'User A should see own inventory rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_inventory_status WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B inventory rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_daily_sales WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 1, 'User A should see own daily sales rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_daily_sales WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B daily sales rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_usage_daily WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 1, 'User A should see own usage daily rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_usage_daily WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 0, 'User A should not see User B usage daily rows');

RESET ROLE;

-- D. Multi-tenant isolation for User B, base tables and views.
SELECT pg_temp.use_test_user('11000000-0000-0000-0000-000000000002');
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true((SELECT count(*) FROM public.customers WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own customers');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.customers WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A customers');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.products WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own products');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.products WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A products');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.orders WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own orders');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.orders WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A orders');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own payments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.payments WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A payments');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.usage_events WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own usage events');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.usage_events WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A usage events');

SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_customer_balances WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own customer balance rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_customer_balances WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A customer balance rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_inventory_status WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own inventory rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_inventory_status WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A inventory rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_daily_sales WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own daily sales rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_daily_sales WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A daily sales rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_usage_daily WHERE owner_id = '11000000-0000-0000-0000-000000000002') = 1, 'User B should see own usage daily rows');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.v_usage_daily WHERE owner_id = '11000000-0000-0000-0000-000000000001') = 0, 'User B should not see User A usage daily rows');

-- E. Append-only INSERT works under owner context.
INSERT INTO public.inventory_movements (
  owner_id,
  product_id,
  movement_type,
  quantity_delta,
  source_type,
  created_by
)
VALUES (
  '11000000-0000-0000-0000-000000000002',
  '31000000-0000-0000-0000-000000000002',
  'purchase',
  1,
  'manual',
  '11000000-0000-0000-0000-000000000002'
);

INSERT INTO public.audit_log (owner_id, actor_id, entity_type, entity_id, action)
VALUES (
  '11000000-0000-0000-0000-000000000002',
  '11000000-0000-0000-0000-000000000002',
  'acceptance',
  NULL,
  'inserted'
);

INSERT INTO public.usage_events (owner_id, event_type)
VALUES ('11000000-0000-0000-0000-000000000002', 'login');

RESET ROLE;

-- E. Append-only UPDATE/DELETE rejects.
DO $$
DECLARE
  v_rejected BOOLEAN;
BEGIN
  v_rejected := false;
  BEGIN
    UPDATE public.inventory_movements
    SET note = 'should fail'
    WHERE id = '61000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: inventory_movements UPDATE should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    DELETE FROM public.inventory_movements
    WHERE id = '61000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: inventory_movements DELETE should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.audit_log
    SET metadata = '{"should":"fail"}'::JSONB
    WHERE entity_type = 'acceptance';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: audit_log UPDATE should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    DELETE FROM public.audit_log
    WHERE entity_type = 'acceptance';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: audit_log DELETE should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    UPDATE public.usage_events
    SET event_type = 'query'
    WHERE id = '91000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: usage_events UPDATE should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    DELETE FROM public.usage_events
    WHERE id = '91000000-0000-0000-0000-000000000001';
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: usage_events DELETE should be rejected';
  END IF;
END;
$$;

-- F. Same-owner invariants reject cross-owner child rows.
DO $$
DECLARE
  v_rejected BOOLEAN;
BEGIN
  v_rejected := false;
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
      '11000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000002',
      'Cross owner',
      1,
      1000,
      1000
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: cross-owner order_items should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.payments (owner_id, customer_id, order_id, amount)
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '21000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000002',
      1000
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: cross-owner payments should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.inventory_movements (
      owner_id,
      product_id,
      movement_type,
      quantity_delta,
      source_type,
      created_by
    )
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000002',
      'purchase',
      1,
      'manual',
      '11000000-0000-0000-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: cross-owner inventory_movements should be rejected';
  END IF;

  v_rejected := false;
  BEGIN
    INSERT INTO public.purchase_items (
      owner_id,
      purchase_id,
      product_id,
      product_name_snapshot,
      quantity,
      unit_cost,
      line_total
    )
    VALUES (
      '11000000-0000-0000-0000-000000000001',
      '42000000-0000-0000-0000-000000000001',
      '31000000-0000-0000-0000-000000000002',
      'Cross owner',
      1,
      1000,
      1000
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;
  IF NOT v_rejected THEN
    RAISE EXCEPTION 'TIP-002 acceptance failed: cross-owner purchase_items should be rejected';
  END IF;
END;
$$;

-- G. Denormalized sync helpers.
SELECT pg_temp.assert_true(
  public.sync_customer_debt_total(
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000011'
  ) = 300000,
  'sync_customer_debt_total should return 300000'
);

SELECT pg_temp.assert_true(
  (
    SELECT debt_total
    FROM public.customers
    WHERE id = '21000000-0000-0000-0000-000000000011'
  ) = 300000,
  'customers.debt_total should be 300000 after sync'
);

SELECT pg_temp.assert_true(
  public.sync_product_current_stock(
    '11000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000011'
  ) = 80,
  'sync_product_current_stock should return 80'
);

SELECT pg_temp.assert_true(
  (
    SELECT current_stock
    FROM public.products
    WHERE id = '31000000-0000-0000-0000-000000000011'
  ) = 80,
  'products.current_stock should be 80 after sync'
);

ROLLBACK;

SELECT 'TIP-002 acceptance passed' AS result;
