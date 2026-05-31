-- TIP-002: Domain schema foundation for So Thong Minh.

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Extend TIP-001 profiles table without dropping existing data or the legacy
-- `name` column currently used by the scaffolded app shell.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS shop_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.profiles
SET
  display_name = COALESCE(display_name, name),
  role = COALESCE(role, 'owner'),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'owner',
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner', 'staff'));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );

  INSERT INTO public.profiles (id, name, display_name)
  VALUES (NEW.id, v_display_name, v_display_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  debt_total NUMERIC(14,0) NOT NULL DEFAULT 0,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customers_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'cái',
  sell_price NUMERIC(14,0),
  cost_price NUMERIC(14,0),
  current_stock NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(14,2),
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT products_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT products_sell_price_non_negative CHECK (sell_price IS NULL OR sell_price >= 0),
  CONSTRAINT products_cost_price_non_negative CHECK (cost_price IS NULL OR cost_price >= 0)
);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT suppliers_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  business_date DATE NOT NULL DEFAULT current_date,
  status TEXT NOT NULL DEFAULT 'confirmed',
  total_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  debt_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  note TEXT,
  raw_input TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT orders_status_check CHECK (status IN ('draft', 'confirmed', 'voided')),
  CONSTRAINT orders_total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT orders_paid_amount_non_negative CHECK (paid_amount >= 0),
  CONSTRAINT orders_paid_not_above_confirmed_total CHECK (
    status <> 'confirmed' OR paid_amount <= total_amount
  )
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT,
  quantity NUMERIC(14,2) NOT NULL,
  unit_price NUMERIC(14,0) NOT NULL,
  line_total NUMERIC(14,0) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT order_items_product_name_snapshot_not_blank CHECK (length(btrim(product_name_snapshot)) > 0),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT order_items_line_total_non_negative CHECK (line_total >= 0)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(14,0) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT,
  note TEXT,
  raw_input TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_method_check CHECK (
    method IS NULL OR method IN ('cash', 'bank_transfer', 'other')
  )
);

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  business_date DATE NOT NULL DEFAULT current_date,
  status TEXT NOT NULL DEFAULT 'confirmed',
  total_amount NUMERIC(14,0) NOT NULL DEFAULT 0,
  note TEXT,
  raw_input TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT purchases_status_check CHECK (status IN ('draft', 'confirmed', 'voided')),
  CONSTRAINT purchases_total_amount_non_negative CHECK (total_amount >= 0)
);

CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  unit_snapshot TEXT,
  quantity NUMERIC(14,2) NOT NULL,
  unit_cost NUMERIC(14,0),
  line_total NUMERIC(14,0) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT purchase_items_product_name_snapshot_not_blank CHECK (length(btrim(product_name_snapshot)) > 0),
  CONSTRAINT purchase_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT purchase_items_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0),
  CONSTRAINT purchase_items_line_total_non_negative CHECK (line_total >= 0)
);

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  movement_type TEXT NOT NULL,
  quantity_delta NUMERIC(14,2) NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_type_check CHECK (
    movement_type IN ('sale', 'purchase', 'adjustment', 'undo')
  ),
  CONSTRAINT inventory_movements_quantity_delta_not_zero CHECK (quantity_delta <> 0),
  CONSTRAINT inventory_movements_source_type_check CHECK (
    source_type IN ('order', 'purchase', 'manual', 'undo')
  )
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_entity_type_not_blank CHECK (length(btrim(entity_type)) > 0),
  CONSTRAINT audit_log_action_not_blank CHECK (length(btrim(action)) > 0)
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  intent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  CONSTRAINT chat_messages_content_not_blank CHECK (length(btrim(content)) > 0)
);

CREATE TABLE public.pending_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preview_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL,
  idempotency_key TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pending_previews_type_check CHECK (
    preview_type IN ('order', 'payment', 'purchase', 'edit_order', 'query')
  ),
  CONSTRAINT pending_previews_status_check CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'expired')
  )
);

CREATE TABLE public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usage_events_type_check CHECK (
    event_type IN ('login', 'order_created', 'order_edited', 'payment_created', 'query', 'undo')
  )
);

CREATE UNIQUE INDEX customers_owner_active_name_uidx
  ON public.customers (owner_id, lower(name))
  WHERE is_active AND deleted_at IS NULL;
CREATE INDEX customers_owner_name_idx ON public.customers (owner_id, name);
CREATE INDEX customers_owner_debt_total_idx ON public.customers (owner_id, debt_total DESC);
CREATE INDEX customers_aliases_gin_idx ON public.customers USING GIN (aliases);
CREATE INDEX customers_name_trgm_idx ON public.customers USING GIN (name extensions.gin_trgm_ops);

CREATE UNIQUE INDEX products_owner_active_name_uidx
  ON public.products (owner_id, lower(name))
  WHERE is_active AND deleted_at IS NULL;
CREATE INDEX products_owner_name_idx ON public.products (owner_id, name);
CREATE INDEX products_owner_current_stock_idx ON public.products (owner_id, current_stock);
CREATE INDEX products_aliases_gin_idx ON public.products USING GIN (aliases);
CREATE INDEX products_name_trgm_idx ON public.products USING GIN (name extensions.gin_trgm_ops);

CREATE UNIQUE INDEX suppliers_owner_active_name_uidx
  ON public.suppliers (owner_id, lower(name))
  WHERE is_active AND deleted_at IS NULL;
CREATE INDEX suppliers_owner_name_idx ON public.suppliers (owner_id, name);
CREATE INDEX suppliers_aliases_gin_idx ON public.suppliers USING GIN (aliases);

CREATE INDEX orders_owner_business_date_idx ON public.orders (owner_id, business_date DESC);
CREATE INDEX orders_owner_customer_business_date_idx ON public.orders (owner_id, customer_id, business_date DESC);
CREATE INDEX orders_owner_status_idx ON public.orders (owner_id, status);
CREATE INDEX orders_owner_created_at_idx ON public.orders (owner_id, created_at DESC);
CREATE UNIQUE INDEX orders_owner_idempotency_key_uidx
  ON public.orders (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX order_items_owner_order_idx ON public.order_items (owner_id, order_id);
CREATE INDEX order_items_owner_product_idx ON public.order_items (owner_id, product_id);

CREATE INDEX payments_owner_customer_paid_at_idx ON public.payments (owner_id, customer_id, paid_at DESC);
CREATE INDEX payments_owner_paid_at_idx ON public.payments (owner_id, paid_at DESC);
CREATE UNIQUE INDEX payments_owner_idempotency_key_uidx
  ON public.payments (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX purchases_owner_business_date_idx ON public.purchases (owner_id, business_date DESC);
CREATE INDEX purchases_owner_supplier_business_date_idx ON public.purchases (owner_id, supplier_id, business_date DESC);
CREATE UNIQUE INDEX purchases_owner_idempotency_key_uidx
  ON public.purchases (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX purchase_items_owner_purchase_idx ON public.purchase_items (owner_id, purchase_id);
CREATE INDEX purchase_items_owner_product_idx ON public.purchase_items (owner_id, product_id);

CREATE INDEX inventory_movements_owner_product_created_idx
  ON public.inventory_movements (owner_id, product_id, created_at DESC);
CREATE INDEX inventory_movements_owner_source_idx
  ON public.inventory_movements (owner_id, source_type, source_id);
CREATE INDEX inventory_movements_owner_created_idx
  ON public.inventory_movements (owner_id, created_at DESC);

CREATE INDEX audit_log_owner_created_idx ON public.audit_log (owner_id, created_at DESC);
CREATE INDEX audit_log_owner_entity_idx ON public.audit_log (owner_id, entity_type, entity_id);
CREATE INDEX audit_log_metadata_gin_idx ON public.audit_log USING GIN (metadata);

CREATE INDEX chat_messages_owner_created_idx ON public.chat_messages (owner_id, created_at DESC);
CREATE INDEX chat_messages_owner_intent_idx ON public.chat_messages (owner_id, intent);

CREATE INDEX pending_previews_owner_status_expires_idx
  ON public.pending_previews (owner_id, status, expires_at);
CREATE INDEX pending_previews_owner_created_idx
  ON public.pending_previews (owner_id, created_at DESC);
CREATE UNIQUE INDEX pending_previews_owner_idempotency_key_uidx
  ON public.pending_previews (owner_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX pending_previews_payload_gin_idx ON public.pending_previews USING GIN (payload);

CREATE INDEX usage_events_owner_created_idx ON public.usage_events (owner_id, created_at DESC);
CREATE INDEX usage_events_owner_type_created_idx
  ON public.usage_events (owner_id, event_type, created_at DESC);
