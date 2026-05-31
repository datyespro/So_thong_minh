# TIP-004 Entity Resolve Notes

## Scope

TIP-004 implements Stage 2: Entity Resolve + Alias Memory.

It consumes an `ExtractedIntent`, resolves raw customer, supplier, and product
names against owner-scoped `customers`, `products`, and `suppliers`, and returns
a `ResolvedIntent`. It does not validate transaction completeness, create
previews, commit business rows, call an LLM, or write usage/chat logs.

The only write path added by TIP-004 is `confirmAlias`, which updates the
`aliases` column on one owner-scoped entity row.

## Matching

Resolution runs in this order:

1. Exact normalized entity name, confidence `1.0`.
2. Exact normalized alias, confidence `0.95`.
3. Fuzzy Dice similarity over normalized character trigrams.

Normalization lowercases, strips Vietnamese combining marks, maps `d` with
stroke to `d`, collapses whitespace, and trims.

Thresholds live in `src/lib/ai/entity-resolver.ts`:

```txt
AUTO_RESOLVE_MIN = 0.81
CONFIRM_MIN      = 0.40
AMBIGUITY_GAP    = 0.12
```

`AUTO_RESOLVE_MIN` is stricter than the initial TIP default so that inputs like
`xi mang trang` against `Xi mang` stay in `needs_confirmation` instead of being
auto-resolved.

## API Routes

`POST /api/ai/resolve-entities`

- Authenticates with the existing RLS-bound Supabase server client.
- Validates `{ intent: ExtractedIntent }`.
- Fetches active, non-deleted rows with explicit `owner_id` filters.
- Returns `{ ok: true, data: ResolvedIntent }`.
- Performs no inserts or updates.

`POST /api/ai/confirm-alias`

- Authenticates with the existing RLS-bound Supabase server client.
- Validates `{ entity_type, entity_id, alias }`.
- Reads the owner-scoped row.
- Appends the original alias text only if no normalized duplicate exists.
- Updates only the `aliases` column.

## Scripts

```bash
pnpm run ai:test-resolve
pnpm run ai:test-isolation
```

`ai:test-resolve` uses in-memory rows only. `ai:test-isolation` uses the service
role only inside the local test harness to create and clean up two auth users,
then verifies RLS-bound reads through normal anon-authenticated clients.

## Migration Status

TIP-004 adds no migration. It uses existing `aliases` columns and existing RLS
policies from TIP-002. It does not enable `unaccent` or `fuzzystrmatch`.
