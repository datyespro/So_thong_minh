# TIP-004-PROBE Report

Status: PASS with one schema naming note. This probe was read-only: no migrations, no source edits, no `supabase db reset`, and no database writes.

## A. Schema inspection - 3 bang entity

### A1. Columns

SQL:

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('customers','products','suppliers')
ORDER BY table_name, ordinal_position;
```

Raw output:

```text
 table_name |  column_name  |        data_type         | is_nullable |  column_default   
------------+---------------+--------------------------+-------------+-------------------
 customers  | id            | uuid                     | NO          | gen_random_uuid()
 customers  | owner_id      | uuid                     | NO          | 
 customers  | name          | text                     | NO          | 
 customers  | phone         | text                     | YES         | 
 customers  | address       | text                     | YES         | 
 customers  | aliases       | ARRAY                    | NO          | '{}'::text[]
 customers  | debt_total    | numeric                  | NO          | 0
 customers  | note          | text                     | YES         | 
 customers  | is_active     | boolean                  | NO          | true
 customers  | created_at    | timestamp with time zone | NO          | now()
 customers  | updated_at    | timestamp with time zone | NO          | now()
 customers  | deleted_at    | timestamp with time zone | YES         | 
 products   | id            | uuid                     | NO          | gen_random_uuid()
 products   | owner_id      | uuid                     | NO          | 
 products   | name          | text                     | NO          | 
 products   | unit          | text                     | NO          | 'cái'::text
 products   | sell_price    | numeric                  | YES         | 
 products   | cost_price    | numeric                  | YES         | 
 products   | current_stock | numeric                  | NO          | 0
 products   | min_stock     | numeric                  | YES         | 
 products   | aliases       | ARRAY                    | NO          | '{}'::text[]
 products   | note          | text                     | YES         | 
 products   | is_active     | boolean                  | NO          | true
 products   | created_at    | timestamp with time zone | NO          | now()
 products   | updated_at    | timestamp with time zone | NO          | now()
 products   | deleted_at    | timestamp with time zone | YES         | 
 suppliers  | id            | uuid                     | NO          | gen_random_uuid()
 suppliers  | owner_id      | uuid                     | NO          | 
 suppliers  | name          | text                     | NO          | 
 suppliers  | phone         | text                     | YES         | 
 suppliers  | address       | text                     | YES         | 
 suppliers  | aliases       | ARRAY                    | NO          | '{}'::text[]
 suppliers  | note          | text                     | YES         | 
 suppliers  | is_active     | boolean                  | NO          | true
 suppliers  | created_at    | timestamp with time zone | NO          | now()
 suppliers  | updated_at    | timestamp with time zone | NO          | now()
 suppliers  | deleted_at    | timestamp with time zone | YES         | 
(37 rows)
```

### A2. Indexes

SQL:

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('customers','products','suppliers')
ORDER BY tablename, indexname;
```

Raw output:

```text
 tablename |            indexname             |                                                                        indexdef                                                                         
-----------+----------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------
 customers | customers_aliases_gin_idx        | CREATE INDEX customers_aliases_gin_idx ON public.customers USING gin (aliases)
 customers | customers_name_trgm_idx          | CREATE INDEX customers_name_trgm_idx ON public.customers USING gin (name gin_trgm_ops)
 customers | customers_owner_active_name_uidx | CREATE UNIQUE INDEX customers_owner_active_name_uidx ON public.customers USING btree (owner_id, lower(name)) WHERE (is_active AND (deleted_at IS NULL))
 customers | customers_owner_debt_total_idx   | CREATE INDEX customers_owner_debt_total_idx ON public.customers USING btree (owner_id, debt_total DESC)
 customers | customers_owner_name_idx         | CREATE INDEX customers_owner_name_idx ON public.customers USING btree (owner_id, name)
 customers | customers_pkey                   | CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id)
 products  | products_aliases_gin_idx         | CREATE INDEX products_aliases_gin_idx ON public.products USING gin (aliases)
 products  | products_name_trgm_idx           | CREATE INDEX products_name_trgm_idx ON public.products USING gin (name gin_trgm_ops)
 products  | products_owner_active_name_uidx  | CREATE UNIQUE INDEX products_owner_active_name_uidx ON public.products USING btree (owner_id, lower(name)) WHERE (is_active AND (deleted_at IS NULL))
 products  | products_owner_current_stock_idx | CREATE INDEX products_owner_current_stock_idx ON public.products USING btree (owner_id, current_stock)
 products  | products_owner_name_idx          | CREATE INDEX products_owner_name_idx ON public.products USING btree (owner_id, name)
 products  | products_pkey                    | CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)
 suppliers | suppliers_aliases_gin_idx        | CREATE INDEX suppliers_aliases_gin_idx ON public.suppliers USING gin (aliases)
 suppliers | suppliers_owner_active_name_uidx | CREATE UNIQUE INDEX suppliers_owner_active_name_uidx ON public.suppliers USING btree (owner_id, lower(name)) WHERE (is_active AND (deleted_at IS NULL))
 suppliers | suppliers_owner_name_idx         | CREATE INDEX suppliers_owner_name_idx ON public.suppliers USING btree (owner_id, name)
 suppliers | suppliers_pkey                   | CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id)
(16 rows)
```

Answers:

- `customers.aliases`: YES. Type is `TEXT[]` as reported by information_schema `data_type=ARRAY`; `NOT NULL`; default `'{}'::text[]`.
- `products.aliases`: YES. Type is `TEXT[]`; `NOT NULL`; default `'{}'::text[]`.
- `suppliers.aliases`: YES. Type is `TEXT[]`; `NOT NULL`; default `'{}'::text[]`.
- GIN indexes on aliases: YES for all three tables: `customers_aliases_gin_idx`, `products_aliases_gin_idx`, `suppliers_aliases_gin_idx`.
- GIN/trigram indexes on names: YES for `customers.name` and `products.name`: `customers_name_trgm_idx`, `products_name_trgm_idx`.
- No trigram name index exists for `suppliers.name`; suppliers only has `(owner_id, name)`, active unique lower name, and aliases GIN.

## B. Extensions inspection

SQL:

```sql
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;
```

Raw output:

```text
      extname       | extversion 
--------------------+------------
 pg_graphql         | 1.5.11
 pg_net             | 0.20.0
 pg_stat_statements | 1.11
 pg_trgm            | 1.6
 pgcrypto           | 1.3
 plpgsql            | 1.0
 supabase_vault     | 0.3.1
 uuid-ossp          | 1.1
(8 rows)
```

Extension status:

- `pg_trgm`: ENABLED (`1.6`).
- `unaccent`: NOT ENABLED.
- `fuzzystrmatch`: NOT ENABLED.

## C. Helper functions / views co san

### C1. Functions trong public schema

SQL:

```sql
SELECT n.nspname, p.proname, pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

Raw output:

```text
 nspname |               proname                |                args                 
---------+--------------------------------------+-------------------------------------
 public  | assert_inventory_movement_same_owner | 
 public  | assert_order_item_same_owner         | 
 public  | assert_order_same_owner              | 
 public  | assert_payment_same_owner            | 
 public  | assert_purchase_item_same_owner      | 
 public  | assert_purchase_same_owner           | 
 public  | expire_pending_previews              | 
 public  | handle_new_user                      | 
 public  | prevent_update_delete_immutable      | 
 public  | set_updated_at                       | 
 public  | sync_customer_debt_total             | p_owner_id uuid, p_customer_id uuid
 public  | sync_product_current_stock           | p_owner_id uuid, p_product_id uuid
(12 rows)
```

### Relevant helper function signatures from TIP-002 helper migration

Source file inspected: `supabase/migrations/20260528085721_tip002_helper_functions.sql`.

Quoted signatures:

```text
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.prevent_update_delete_immutable()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.sync_customer_debt_total(
  p_owner_id UUID,
  p_customer_id UUID
)
RETURNS NUMERIC

CREATE OR REPLACE FUNCTION public.sync_product_current_stock(
  p_owner_id UUID,
  p_product_id UUID
)
RETURNS NUMERIC

CREATE OR REPLACE FUNCTION public.expire_pending_previews()
RETURNS INTEGER

CREATE OR REPLACE FUNCTION public.assert_order_same_owner()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.assert_order_item_same_owner()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.assert_purchase_same_owner()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.assert_purchase_item_same_owner()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.assert_payment_same_owner()
RETURNS TRIGGER

CREATE OR REPLACE FUNCTION public.assert_inventory_movement_same_owner()
RETURNS TRIGGER
```

Search/match/normalize/similarity evidence:

```text
Select-String pattern: normalize|search|match|similarity
Result: no function names or bodies for normalize/search/match/similarity were found.
Only SET search_path = public lines matched the substring "search".
```

Conclusion:

- Existing TIP-002 helpers are mostly invariants, denormalized sync, and timestamp/update protection.
- No reusable SQL function currently exists for entity resolver name normalization, unaccenting, alias expansion, search, match scoring, or trigram similarity.
- Existing views relevant to read/reporting exist from TIP-002 (`v_customer_balances`, `v_inventory_status`, `v_daily_sales`, `v_usage_daily`), but no entity-search view exists.

## D. Codebase conventions cho AI layer

### D1. `src/lib/ai/intent-schema.ts`

Top structure:

```ts
import { z } from "zod";

export const IntentNameSchema = z.enum([
  "create_order",
  "record_payment",
  "create_purchase",
  "query_debt",
  "query_inventory",
  "query_sales",
  "edit_order",
  "undo",
  "small_talk",
  "unknown",
]);

export const PaymentStatusSchema = z.enum([
  "paid",
  "partial",
  "debt",
  "unknown",
]);

export const TimeRangeSchema = z.object({
  raw: z.string().nullable(),
  kind: z
    .enum(["today", "yesterday", "this_week", "this_month", "custom", "unknown"])
    .default("unknown"),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});
```

Entity shape evidence:

```ts
export const ExtractedItemSchema = z.object({
  raw: z.string(),
  product_name: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
  confidence: z.number().min(0).max(1),
});

entities: z.object({
  customer_name: z.string().nullable(),
  supplier_name: z.string().nullable(),
  product_name: z.string().nullable(),
  items: z.array(ExtractedItemSchema).default([]),
  amount: z.number().nullable(),
  payment_status: PaymentStatusSchema.default("unknown"),
  payment_method: z.string().nullable(),
  order_reference: z.string().nullable(),
  business_date: z.string().nullable(),
  time_range: TimeRangeSchema,
})
```

Stage 2 implication:

- Resolver input should consume raw strings from `entities.customer_name`, `entities.supplier_name`, `entities.product_name`, and each `entities.items[].product_name`.
- Product can appear both as top-level `product_name` and in `items[]`; TIP-004 should define precedence/merge behavior.

### D2. `src/lib/ai/extract-intent.ts`

Top structure:

```ts
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  ExtractedIntentOutputSchema,
  ExtractedIntentSchema,
  type ExtractedIntent,
} from "@/src/lib/ai/intent-schema";
import { getIntentModel } from "@/src/lib/ai/provider";
import { buildExtractIntentPrompt } from "@/src/lib/ai/prompts/extract-intent";

export type ExtractIntentInput = {
  rawText: string;
  ownerId: string;
  todayISO?: string;
};

type GenerateStructuredIntent = (input: {
  prompt: string;
}) => Promise<unknown>;
```

Pattern evidence:

```ts
export async function defaultGenerateStructuredIntent(input: {
  prompt: string;
}): Promise<unknown> {
  const result = await generateText({
    model: getIntentModel(),
    output: Output.object({
      schema: ExtractedIntentOutputSchema,
      name: "ExtractedIntent",
      description:
        "Structured business intent extracted from one Vietnamese shop-owner message",
    }),
    prompt: input.prompt,
    temperature: 0,
  });

  return result.output;
}
```

Notes:

- No Supabase client is initialized inside `extract-intent.ts`.
- Error pattern uses `IntentExtractionError` with typed codes and preserved `cause`.
- AI provider call uses AI SDK `generateText` + `Output.object`.
- Testability pattern: dependency injection via `generateStructuredIntent`.

### D3. `app/api/ai/extract-intent/route.ts`

Top structure:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractIntent,
  IntentExtractionError,
} from "@/src/lib/ai/extract-intent";
import { createClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  text: z.string(),
});
```

Auth and route pattern evidence:

```ts
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("UNAUTHORIZED", "Please log in.", 401);
  }
```

Error mapping evidence:

```ts
const errorMessages: Record<IntentExtractionError["code"], string> = {
  EMPTY_INPUT: "Message is required.",
  INPUT_TOO_LONG: "Message is too long.",
  AI_CONFIG_MISSING: "OPENAI_API_KEY is not configured.",
  INTENT_EXTRACTION_FAILED: "Could not extract intent.",
};
```

Chat logging evidence:

```ts
const logResult = await supabase.from("chat_messages").insert([
  {
    owner_id: user.id,
    role: "user",
    content: rawText.trim(),
    intent: null,
    metadata: { source: "api/ai/extract-intent" },
  },
  {
    owner_id: user.id,
    role: "assistant",
    content: `Đã nhận diện: ${extracted.intent}`,
    intent: extracted.intent,
    metadata: {
      source: "stage_1_extract_intent",
      extracted,
      confidence: extracted.confidence,
    },
  },
]);
```

Notes:

- Route uses `createClient()` from `src/lib/supabase/server`, not service role.
- Route inserts only `chat_messages`.
- Logging failure is warning-only; successful extraction still returns data.

### D4. `src/lib/ai/provider.ts`

Full file:

```ts
import { openai } from "@ai-sdk/openai";

export const DEFAULT_AI_MODEL = "gpt-4.1-mini";

export function getIntentModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI_CONFIG_MISSING");
  }

  return openai(process.env.AI_MODEL || DEFAULT_AI_MODEL);
}
```

### D5. Files under `src/lib/ai/`

Raw output:

```text
FullName                                                 
--------                                                 
D:\code\Sotm_project\src\lib\ai\prompts                  
D:\code\Sotm_project\src\lib\ai\extract-intent.ts        
D:\code\Sotm_project\src\lib\ai\intent-schema.ts         
D:\code\Sotm_project\src\lib\ai\provider.ts              
D:\code\Sotm_project\src\lib\ai\prompts\extract-intent.ts
```

### D6. `ActionResult` type

File: `src/types/action-result.ts`

```ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "unauthorized"
  | "invalid_credentials"
  | "validation_failed"
  | "db_error"
  | "internal";
```

## E. Seed data hien tai

### E1. Counts

SQL:

```sql
SELECT count(*) AS customers_count FROM customers;
SELECT count(*) AS products_count FROM products;
SELECT count(*) AS suppliers_count FROM suppliers;
```

Raw output:

```text
 customers_count 
-----------------
               0
(1 row)

 products_count 
----------------
              0
(1 row)

 suppliers_count 
-----------------
               0
(1 row)
```

### E2. Query requested by TIP for customers

SQL:

```sql
SELECT id, full_name, COALESCE(aliases, ARRAY[]::TEXT[]) AS aliases
FROM customers LIMIT 10;
```

Raw output:

```text
ERROR:  column "full_name" does not exist
LINE 1: SELECT id, full_name, COALESCE(aliases, ARRAY[]::TEXT[]) AS ...
                   ^
```

Note: current schema uses `customers.name`, not `customers.full_name`.

### E3. Corrected read query using current schema

SQL:

```sql
SELECT id, name, COALESCE(aliases, ARRAY[]::TEXT[]) AS aliases FROM customers LIMIT 10;
SELECT id, name, COALESCE(aliases, ARRAY[]::TEXT[]) AS aliases FROM products LIMIT 10;
SELECT id, name FROM suppliers LIMIT 10;
```

Raw output:

```text
 id | name | aliases 
----+------+---------
(0 rows)

 id | name | aliases 
----+------+---------
(0 rows)

 id | name 
----+------
(0 rows)
```

Seed data conclusion:

- Current local DB has zero customers/products/suppliers.
- `supabase/seed.sql` is safe and skips when no local auth user exists.
- Rows with aliases currently present in DB: `0`.

### E4. Seed file snippets for entity tables

File: `supabase/seed.sql`.

```sql
IF v_owner_id IS NULL THEN
  RAISE NOTICE 'TIP-002 seed skipped: create a local auth user first, then insert owner-scoped sample rows if needed.';
  RETURN;
END IF;

INSERT INTO public.customers (owner_id, name, phone, aliases, note)
VALUES (v_owner_id, 'Cô Lan', NULL, ARRAY['co lan', 'lan'], 'TIP-002 seed')
RETURNING id INTO v_customer_lan;

INSERT INTO public.customers (owner_id, name, phone, aliases, note)
VALUES (v_owner_id, 'Anh Hùng', NULL, ARRAY['anh hung', 'hung'], 'TIP-002 seed')
RETURNING id INTO v_customer_hung;

INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
VALUES (v_owner_id, 'Xi măng', 'bao', 85000, 78000, 10, ARRAY['xi mang', 'ximang'])
RETURNING id INTO v_product_xi_mang;

INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
VALUES (v_owner_id, 'Gạch đỏ', 'viên', 1500, 1200, 1000, ARRAY['gach do'])
RETURNING id INTO v_product_gach_do;

INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
VALUES (v_owner_id, 'Cát vàng', 'khối', 350000, 300000, 2, ARRAY['cat vang'])
RETURNING id INTO v_product_cat_vang;

INSERT INTO public.suppliers (owner_id, name, aliases, note)
VALUES (v_owner_id, 'Nhà cung cấp A', ARRAY['ncc a'], 'TIP-002 seed')
RETURNING id INTO v_supplier;
```

## F. RLS & owner_id check

### F1. Confirm RLS enabled

SQL:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('customers','products','suppliers');
```

Raw output:

```text
 tablename | rowsecurity 
-----------+-------------
 customers | t
 products  | t
 suppliers | t
(3 rows)
```

### F2. List policies

SQL:

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('customers','products','suppliers')
ORDER BY tablename, policyname;
```

Raw output:

```text
 tablename |      policyname      |  cmd   |                   qual                   
-----------+----------------------+--------+------------------------------------------
 customers | customers_delete_own | DELETE | (( SELECT auth.uid() AS uid) = owner_id)
 customers | customers_insert_own | INSERT | 
 customers | customers_select_own | SELECT | (( SELECT auth.uid() AS uid) = owner_id)
 customers | customers_update_own | UPDATE | (( SELECT auth.uid() AS uid) = owner_id)
 products  | products_delete_own  | DELETE | (( SELECT auth.uid() AS uid) = owner_id)
 products  | products_insert_own  | INSERT | 
 products  | products_select_own  | SELECT | (( SELECT auth.uid() AS uid) = owner_id)
 products  | products_update_own  | UPDATE | (( SELECT auth.uid() AS uid) = owner_id)
 suppliers | suppliers_delete_own | DELETE | (( SELECT auth.uid() AS uid) = owner_id)
 suppliers | suppliers_insert_own | INSERT | 
 suppliers | suppliers_select_own | SELECT | (( SELECT auth.uid() AS uid) = owner_id)
 suppliers | suppliers_update_own | UPDATE | (( SELECT auth.uid() AS uid) = owner_id)
(12 rows)
```

Confirmation:

- `customers.owner_id`: exists, UUID, NOT NULL.
- `products.owner_id`: exists, UUID, NOT NULL.
- `suppliers.owner_id`: exists, UUID, NOT NULL.
- RLS is enabled on all three tables.
- SELECT/UPDATE/DELETE policies filter with `(( SELECT auth.uid() AS uid) = owner_id)`.
- INSERT policies have empty `qual` because INSERT policy uses `WITH CHECK`, not shown by the requested `qual` query. TIP-002 pattern indicates owner-scoped insert checks; if TIP-004 needs full policy evidence, query `with_check` too.

## G. Recommendations

### 1. Aliases columns

Need migration for aliases: NO.

All three entity tables already have:

- `aliases TEXT[] NOT NULL DEFAULT '{}'::text[]`
- GIN index on `aliases`

Recommendation: keep `TEXT[]` for MVP resolver. It is simple, already indexed, and matches current seed/TIP-002 conventions. Avoid switching to `JSONB` in TIP-004 unless alias metadata becomes necessary (source, confidence, created_by, frequency). For TIP-004, a separate app-level resolver can read `name` + `aliases`; alias memory writes can come later if the TIP explicitly includes them.

### 2. Extensions

- `pg_trgm`: already enabled. No migration needed for this extension.
- `unaccent`: not enabled. Recommendation: TIP-004 should add a migration enabling `unaccent` if resolver needs accent-insensitive matching in SQL. Vietnamese inputs from Stage 1 and user aliases will often vary by accent, so this is valuable.
- `fuzzystrmatch`: not enabled. Recommendation: do not enable by default for MVP unless TIP-004 specifically needs phonetic/edit-distance functions. `pg_trgm` + normalized lowercase/unaccent matching is likely enough.

Migration estimate for extensions/helper SQL: one small TIP-004 migration if adding `unaccent` and/or normalization functions.

### 3. Reusable helpers

Reusable from TIP-002:

- `set_updated_at()` can be reused if TIP-004 adds alias-memory tables or editable resolver metadata tables.
- Same-owner invariant trigger patterns are useful if TIP-004 creates child tables that reference entity rows.

Not directly reusable for resolver search:

- No normalize/search/match/similarity helper exists.
- `sync_customer_debt_total`, `sync_product_current_stock`, and `expire_pending_previews` are unrelated to entity resolution.

Recommendation: implement resolver helpers in TypeScript first for TIP-004 unless SQL search performance is required immediately. If SQL helpers are added, keep them small: `normalize_entity_text(text)` and maybe per-table search RPC functions scoped by `owner_id`.

### 4. Convention conflicts

No major conflict with TIP-003 conventions.

TIP-003 conventions to follow:

- Put AI/business pipeline code under `src/lib/ai/`.
- Use Zod schemas and exported inferred types.
- Keep server-only provider/DB code out of Client Components.
- Use dependency injection in functions for unit tests.
- Keep route auth with `createClient()` and `auth.getUser()` if TIP-004 exposes an API route.
- Preserve typed errors rather than leaking raw provider/database errors to clients.

Potential naming conflict:

- Probe input query used `customers.full_name`, but schema uses `customers.name`.
- TIP-004 should refer to `customers.name`, `products.name`, and `suppliers.name`.

### 5. Seed gap

Current local DB has zero entity rows because seed skips without an auth user.

Recommended resolver test seed/fixtures:

- At least 5 customers with aliases:
  - `Cô Lan` aliases `["co lan", "lan", "c lan"]`
  - `Anh Hùng` aliases `["anh hung", "hung"]`
  - `Chị Hạnh` aliases `["chi hanh", "hanh"]`
  - `Cô Lành` aliases `["co lanh", "lanh"]`
  - `Lan Anh` aliases `["lan anh"]`
- At least 5 products with aliases:
  - `Xi măng` aliases `["xi mang", "ximang", "xm"]`
  - `Xi măng Hà Tiên` aliases `["ha tien", "xi mang ht"]`
  - `Gạch đỏ` aliases `["gach do"]`
  - `Cát vàng` aliases `["cat vang"]`
  - `Thép phi 10` aliases `["thep phi 10", "sắt 10"]`
- At least 2 suppliers with aliases:
  - `Nhà cung cấp A` aliases `["ncc a"]`
  - `Công ty VLXD Minh Long` aliases `["minh long", "vlxd minh long"]`
- Ambiguous cases:
  - customer `Cô Lan` vs `Cô Lành`
  - product `Xi măng` vs `Xi măng Hà Tiên`
  - alias collision such as `lan` for customer name search should return ambiguous candidates, not auto-resolve.

Estimated rows for serious resolver tests: 12-15 total entity rows plus focused aliases.

### 6. Complexity estimate

Estimated TIP-004 complexity: medium.

Estimated new files:

- `src/lib/ai/entity-resolve-schema.ts`
- `src/lib/ai/entity-resolve.ts`
- `src/lib/ai/entity-resolve-errors.ts` or shared pipeline error file
- `app/api/ai/resolve-entities/route.ts` if TIP-004 exposes a route
- `tests/ai/entity-resolve.test.ts`
- `tests/ai/entity-resolve-schema.test.ts`
- optional `supabase/tests/tip004_entity_resolve.sql`
- optional docs file `docs/ai/TIP-004_ENTITY_RESOLVE_NOTES.md`

Estimated new migrations:

- 0 if resolver is TypeScript-only and uses existing columns/indexes.
- 1 if enabling `unaccent` or adding SQL normalization/search helper functions.

Estimated new unit tests:

- 12-18 tests for exact name, alias match, unaccent/case-insensitive match, trigram/fuzzy fallback, ambiguity, no-match, owner isolation, product item resolution, supplier resolution, and no DB writes.

Blockers/questions for Contractor:

- Decide whether TIP-004 should add SQL `unaccent` and normalization functions now, or keep normalization in TypeScript for MVP.
- Decide expected resolver output shape for ambiguous matches: top N candidates with scores vs single result plus `needs_clarification`.
- Confirm whether TIP-004 should write learned aliases or remain read-only entity resolution. Current Next TIP name mentions "Alias Memory", but this probe goal is pre-flight only.
