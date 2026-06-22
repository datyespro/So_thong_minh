-- TIP-DC-1: Product category foundation (1-level, flat) for So Thong Minh.
-- Owner-scoped, soft-delete, unique active-name.
-- Mirrors: ai_interactions (REVOKE anon+authenticated -> GRANT SELECT/INSERT/UPDATE,
-- GRANT ALL service_role, 3 own-policies using (SELECT auth.uid()) = owner_id) and
-- products (soft-delete + partial unique active-name index technique).

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT product_categories_name_not_blank CHECK (length(btrim(name)) > 0)
);

-- Unique active-name per owner. Mirrors products_owner_active_name_uidx technique
-- (lower(name) + partial WHERE). This table has no is_active column, so "active"
-- means deleted_at IS NULL only.
CREATE UNIQUE INDEX product_categories_owner_active_name_uidx
  ON public.product_categories (owner_id, lower(name))
  WHERE deleted_at IS NULL;

-- Owner-scoped listing/sort by name (mirror of products_owner_name_idx).
CREATE INDEX product_categories_owner_name_idx
  ON public.product_categories (owner_id, name);

REVOKE ALL ON TABLE public.product_categories FROM anon;
REVOKE ALL ON TABLE public.product_categories FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.product_categories TO authenticated;
GRANT ALL ON TABLE public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_categories_select_own
  ON public.product_categories
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY product_categories_insert_own
  ON public.product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY product_categories_update_own
  ON public.product_categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);
-- No DELETE policy / no DELETE grant: removal is soft-delete via UPDATE deleted_at.

-- Classification column for products: nullable, FK unlinks (SET NULL) on hard delete.
-- Soft-delete of a category (UPDATE deleted_at) does NOT trigger SET NULL; DC-5
-- aggregation falls back to "Chua phan loai" for deleted categories.
ALTER TABLE public.products
  ADD COLUMN category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- Owner-scoped category lookup (mirror of products_owner_<col>_idx convention;
-- supports DC-5 group-by-category and keeps the FK efficient). Partial: only
-- products that are classified.
CREATE INDEX products_owner_category_idx
  ON public.products (owner_id, category_id)
  WHERE category_id IS NOT NULL;
