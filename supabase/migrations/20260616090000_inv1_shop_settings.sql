-- INV-1: Shop settings for invoice header (name, phone, address).
-- One row per owner. Forward-only, does not touch existing tables.

CREATE TABLE public.shop_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- GRANT: authenticated can SELECT + INSERT + UPDATE only; no DELETE for one-row upsert.
REVOKE ALL ON TABLE public.shop_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shop_settings TO authenticated;
GRANT ALL ON TABLE public.shop_settings TO service_role;

-- Policies: owner-scoped
CREATE POLICY shop_settings_select_own
  ON public.shop_settings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY shop_settings_insert_own
  ON public.shop_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY shop_settings_update_own
  ON public.shop_settings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);
