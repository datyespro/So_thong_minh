-- TIP-002: Row Level Security and Data API grants.

GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON TABLE
  public.profiles,
  public.customers,
  public.products,
  public.suppliers,
  public.orders,
  public.order_items,
  public.payments,
  public.purchases,
  public.purchase_items,
  public.inventory_movements,
  public.audit_log,
  public.chat_messages,
  public.pending_previews,
  public.usage_events
FROM anon;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.customers,
  public.products,
  public.suppliers,
  public.orders,
  public.order_items,
  public.payments,
  public.purchases,
  public.purchase_items,
  public.chat_messages,
  public.pending_previews
TO authenticated;

GRANT SELECT, INSERT ON TABLE
  public.inventory_movements,
  public.audit_log,
  public.usage_events
TO authenticated;

GRANT ALL ON TABLE
  public.profiles,
  public.customers,
  public.products,
  public.suppliers,
  public.orders,
  public.order_items,
  public.payments,
  public.purchases,
  public.purchase_items,
  public.inventory_movements,
  public.audit_log,
  public.chat_messages,
  public.pending_previews,
  public.usage_events
TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_owner_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers',
    'products',
    'suppliers',
    'orders',
    'order_items',
    'payments',
    'purchases',
    'purchase_items',
    'chat_messages',
    'pending_previews'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_own', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id)',
      t || '_select_own',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id)',
      t || '_insert_own',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = owner_id) WITH CHECK ((SELECT auth.uid()) = owner_id)',
      t || '_update_own',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = owner_id)',
      t || '_delete_own',
      t
    );
  END LOOP;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_movements',
    'audit_log',
    'usage_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_own', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_own', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id)',
      t || '_select_own',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = owner_id)',
      t || '_insert_own',
      t
    );
  END LOOP;
END;
$$;
