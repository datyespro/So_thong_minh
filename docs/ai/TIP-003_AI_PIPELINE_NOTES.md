# TIP-003 AI Pipeline Notes

## Scope

TIP-003 implements Stage 1: Extract Intent.

This stage reads one Vietnamese shop-owner message and returns a strict `ExtractedIntent` object. It does not resolve database IDs, write business tables, create pending previews, or commit transactions.

Pipeline context:

```txt
User text
  -> Stage 1 Extract Intent
  -> Stage 2 Entity Resolve
  -> Stage 3 Validate
  -> Stage 4 Preview + Confirm
  -> Stage 5 Commit transaction
```

## Files

- `src/lib/ai/intent-schema.ts`: Zod schemas and exported TypeScript types.
- `src/lib/ai/prompts/extract-intent.ts`: Vietnamese extraction prompt and examples.
- `src/lib/ai/provider.ts`: OpenAI provider setup using `AI_MODEL` or `gpt-4.1-mini`.
- `src/lib/ai/extract-intent.ts`: server-side extraction function with validation and typed errors.
- `app/api/ai/extract-intent/route.ts`: protected App Router endpoint.
- `scripts/ai/test-extract-intent.ts`: optional live test script.

## Schema

The required intent enum is:

```txt
create_order
record_payment
create_purchase
query_debt
query_inventory
query_sales
edit_order
undo
small_talk
unknown
```

Main output fields:

- `intent`
- `confidence`
- `raw_text`
- `normalized_text`
- `language`
- `entities.customer_name`
- `entities.supplier_name`
- `entities.product_name`
- `entities.items`
- `entities.amount`
- `entities.payment_status`
- `entities.payment_method`
- `entities.order_reference`
- `entities.business_date`
- `entities.time_range`
- `missing_info`
- `warnings`
- `needs_confirmation`
- `next_stage_hint`

## Prompt Rules

The prompt tells the model:

- The app is for Vietnamese construction-material shops.
- Users may type shorthand, misspellings, and unaccented Vietnamese.
- Only classify intent and extract raw fields.
- Do not create or infer database IDs.
- Do not write database data.
- Do not invent customers, products, quantities, prices, or dates.
- Put missing critical information in `missing_info`.
- Return only schema-compatible structured output.

## API Route

`POST /api/ai/extract-intent`

Request:

```json
{ "text": "Bán cho cô Lan 10 bao xi măng 85k, nợ" }
```

The route:

1. Creates the existing Supabase server client.
2. Calls `auth.getUser()`.
3. Returns `401` if no user is authenticated.
4. Calls `extractIntent({ rawText, ownerId: user.id })`.
5. Inserts two `chat_messages` rows using `owner_id = auth.uid()`.
6. Returns `{ "ok": true, "data": ExtractedIntent }`.

The route does not use the service-role client and does not write business tables.

## Environment

Required for live AI calls:

```env
OPENAI_API_KEY=...
AI_MODEL=gpt-4.1-mini
```

`AI_MODEL` is optional and defaults to `gpt-4.1-mini`.

If `OPENAI_API_KEY` is missing, the API returns `AI_CONFIG_MISSING`. The live test script skips gracefully.

## Test Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
supabase status
supabase db reset
pnpm run ai:test-intent
```

## Known Limitations

- Stage 1 does not resolve customer, product, supplier, or order IDs.
- Stage 1 does not decide whether a transaction is valid.
- Stage 1 does not write `orders`, `payments`, `inventory_movements`, `pending_previews`, or `usage_events`.
- Live AI output should not be snapshot-tested exactly because model output may vary while still matching schema.
