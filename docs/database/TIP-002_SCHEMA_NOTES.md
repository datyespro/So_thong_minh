# TIP-002 Schema Notes

## Scope

TIP-002 creates the multi-tenant database foundation for the Sổ Thông Minh MVP:

- 14 public domain tables: `profiles`, `customers`, `products`, `suppliers`, `orders`, `order_items`, `payments`, `purchases`, `purchase_items`, `inventory_movements`, `audit_log`, `chat_messages`, `pending_previews`, `usage_events`.
- Owner isolation via `owner_id` and RLS on every public table.
- Query/report views using `WITH (security_invoker = true)` so base table RLS still applies.
- Helper functions and triggers for timestamps, append-only tables, denormalized sync, preview expiry, and same-owner FK invariants.

TIP-002 intentionally does not implement business transaction functions such as `create_order`, `edit_order`, or `undo_order`; those belong to later TIPs.

## Existing Profiles Table

TIP-001 already created `public.profiles` with `id`, `name`, and `created_at`. This TIP keeps the legacy `name` column because the current app shell still reads it, and adds the required TIP-002 columns:

- `display_name`
- `phone`
- `shop_name`
- `role`
- `updated_at`

The signup trigger now fills both `name` and `display_name` for compatibility.

## RLS Model

All owner-owned business tables use `owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.

Editable owner tables allow authenticated users to select, insert, update, and delete only rows where:

```sql
(SELECT auth.uid()) = owner_id
```

Append-only tables allow only owner-scoped `SELECT` and `INSERT` policies:

- `inventory_movements`
- `audit_log`
- `usage_events`

`inventory_movements`, `audit_log`, and `usage_events` also have database triggers that reject `UPDATE` and `DELETE`.

## Denormalized Fields

`customers.debt_total` and `products.current_stock` are denormalized for fast MVP queries.

Source-of-truth data remains:

- customer debt: confirmed non-deleted `orders.debt_amount` minus non-deleted `payments.amount`
- stock: sum of `inventory_movements.quantity_delta`

The helper functions `sync_customer_debt_total(owner_id, customer_id)` and `sync_product_current_stock(owner_id, product_id)` recalculate these fields. Later business transaction functions should call them in the same transaction.

## Same-owner Invariants

Triggers reject cross-owner child rows for:

- `orders.customer_id`
- `order_items.order_id`
- `order_items.product_id`
- `purchases.supplier_id`
- `purchase_items.purchase_id`
- `purchase_items.product_id`
- `payments.customer_id`
- `payments.order_id`
- `inventory_movements.product_id`

This keeps AI-generated or app-generated writes from creating rows whose direct `owner_id` disagrees with parent records.

## Local Reset And Verify

Start local Supabase, then run:

```bash
supabase status
supabase db reset
```

If `DATABASE_URL` is set:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tip002_verify.sql
```

For the default local Supabase database:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/tip002_verify.sql
```

If `psql` is not installed on the host, run it inside the local Supabase Postgres container:

```bash
docker cp supabase/tests/tip002_verify.sql supabase_db_Sotm_project:/tmp/tip002_verify.sql
docker exec supabase_db_Sotm_project psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/tip002_verify.sql
```

## Seed Behavior

`supabase/seed.sql` does not create a fake auth user. On a clean reset with no local auth users, it prints a notice and skips.

After creating a local user through the app or Supabase Auth, insert sample rows manually or rerun adapted seed SQL using that user's `auth.users.id`.

The optional seed dataset is intentionally tiny:

- customers: `Cô Lan`, `Anh Hùng`
- products: `Xi măng`, `Gạch đỏ`, `Cát vàng`
- supplier: `Nhà cung cấp A`
- one order, one payment, two inventory movements, and three usage events

## Trade-offs

- Child rows store `owner_id` even when it could be inferred from parents. This makes RLS and indexes simpler and reduces tenant-leak risk in AI query paths.
- Partial unique indexes use `lower(name)` for active names per owner, while separate `(owner_id, name)` indexes preserve the requested query shape.
- `usage_events` intentionally stores no content or metadata in MVP.
- Hard DELETE policies exist on editable tables for local/admin cleanup, but product flows should prefer soft delete via `deleted_at`.
