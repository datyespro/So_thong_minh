# TIP-005b Chat UI Notes

## Scope

- Built the protected `/chat` scaffold under `app/(app)`.
- The page loads `chat_messages` with the RLS-bound server client and an explicit `owner_id` filter.
- `sendMessage` inserts exactly one `chat_messages` row with `role = "user"` and `metadata.source = "chat_ui_scaffold"`.
- The assistant acknowledgement is client-only state and is not persisted.

## Deliberate Non-Goals

- No calls to `/api/ai/extract-intent`, `/api/ai/resolve-entities`, or `/api/ai/validate-intent`.
- No preview cards, entity confirmation modal, realtime subscription, voice UI, migrations, or service-role client.
- No writes to business tables or `usage_events`.

## UI Choices

- Desktop-first chat frame with a max width near 760px, while keeping the input usable on mobile.
- Text sizes are 16px or larger in the message surface and textarea to avoid iOS focus zoom.
- Empty state includes one concrete Vietnamese example so the first screen feels like a familiar messaging app.

## Tests

- `tests/chat/send-message-action.test.ts` covers auth, blank/long validation, insert shape, DB error handling, and the fact that no assistant row is inserted.
- `tests/chat/message-list.test.tsx` uses `react-dom/server` because the repo does not currently include RTL/jsdom.
