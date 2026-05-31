# TIP-005a Validate Notes

## Scope

TIP-005a implements Stage 3 validation for resolved intents. It is pure
TypeScript for rule evaluation, with a small read-only orchestrator for owner
scoped master data.

It does not create previews, commit business rows, write logs, update aliases,
call an LLM, add migrations, or enable database extensions.

## Contract

`validateResolvedIntent(resolved, masters)` is deterministic and has no I/O.
`validateIntent({ resolved, ownerId, supabase })` fetches only the master rows
needed for writable intents:

- `products`: `id,name,unit,sell_price,cost_price`
- `customers`: `id,debt_total` for `record_payment`

Queries are RLS-bound and include explicit `owner_id` filters.

`ResolvedIntent` now accepts optional `amount`, `payment_status`, and
`payment_method` fields. TIP-004 `resolveEntities` populates them from
`ExtractedIntent` so Stage 3 can validate `record_payment` without re-reading or
re-running Stage 1.

## Routing

- `create_order`, `record_payment`, `create_purchase`: `kind="writable"`
- `query_debt`, `query_inventory`, `query_sales`: `kind="query"`
- `edit_order`: `kind="edit"`
- `undo`: `kind="undo"`
- `small_talk`, `unknown`: `kind="none"`

Non-writable intents pass through with no validation issues and
`ready_for_preview=false`.

## Validation

Writable validation emits mom-friendly Vietnamese issues with stable codes:

- Customer/supplier missing or unresolved blocks preview.
- Item product unresolved, missing/invalid quantity, and missing price block
  preview.
- Product prices are autofilled from master data when available.
- Unit mismatch, payment-status unknown, payment-method unknown, and
  overpayment are warnings.

Current rule choice: query intents preserve resolved items for downstream query
handling, but do not compute effective fields or issues.

## Commands

```bash
pnpm run ai:test-validate
pnpm run ai:test-validate-db
```

If Auth returns 502 after `supabase db reset`, restart Kong:

```bash
docker restart supabase_kong_Sotm_project
```
