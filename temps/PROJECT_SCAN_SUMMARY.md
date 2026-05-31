# PROJECT SCAN SUMMARY — Sổ Thông Minh

> Generated: 2026-05-28
> Repo: `D:/code/Sotm_project`

## TL;DR
- Đây là repo **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind/shadcn** cho MVP “Sổ Thông Minh”.
- Backend data dùng **Supabase Postgres + Auth + RLS**. DB schema nền tảng (TIP-002) đã có migrations + SQL tests.
- AI pipeline hiện **đã implement Stage 1: Extract Intent** (TIP-003) bằng Vercel AI SDK + Zod schema, có API route bảo vệ auth.
- UI hiện có **login page** + **app shell (protected)** + **chat page placeholder** (input disabled, đang ở giai đoạn scaffold UI).
- Trạng thái theo docs: **TIP-001/002/003 DONE + APPROVED**, next là **TIP-004 Entity Resolve + Alias Memory**.

## 1) Tech stack & scripts
Xem `package.json`.
- Runtime:
  - `next@15`, `react@19`, `typescript@5`
  - Supabase: `@supabase/ssr`, `@supabase/supabase-js`
  - AI: `ai` + `@ai-sdk/openai`
  - Schema: `zod`
- Tooling:
  - `eslint`, `vitest`, `tsx`
- Scripts đáng chú ý:
  - `pnpm dev`, `pnpm build`, `pnpm start`
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`
  - `pnpm ai:test-intent` (live test Stage 1 nếu có `OPENAI_API_KEY`)

## 2) High-level structure
(Chỉ liệt kê các phần “source of truth”, bỏ qua `.next/` và `node_modules/`.)
- `app/`: Next.js App Router (routes/layouts + API route).
  - `app/(auth)/login/page.tsx`: màn đăng nhập.
  - `app/(app)/layout.tsx`: layout app đã guard auth.
  - `app/(app)/chat/page.tsx`: chat page UI placeholder.
  - `app/api/ai/extract-intent/route.ts`: endpoint Stage 1.
- `src/`:
  - `src/lib/ai/*`: intent schema + prompt + provider + extractor.
  - `src/lib/supabase/*`: supabase clients (browser/server/admin) + session proxy.
  - `src/components/*`: UI components (AuthGuard/AppShell/LoginForm, shadcn ui).
- `supabase/`:
  - `supabase/migrations/*`: migrations TIP-002.
  - `supabase/tests/*`: SQL verify/acceptance tests TIP-002.
  - `supabase/seed.sql`: seed dữ liệu owner-scoped (nếu đã có local auth user).
  - `supabase/config.toml`: cấu hình Supabase local.
- `docs/`: ghi chú TIP (AI + database).
- `y tuong/`: blueprint/vision/context handoff (nguồn roadmap + quyết định).

## 3) UI & routes hiện có (Next.js)
### Root layout
- `app/layout.tsx` cấu hình font (Be Vietnam Pro / JetBrains Mono / Lora), metadata title/description, base body class.

### Auth area
- `app/(auth)/layout.tsx`: wrapper nền giấy.
- `app/(auth)/login/page.tsx`: landing/login page theo style “sổ giấy” + component `LoginForm`.

### App area (protected)
- `app/(app)/layout.tsx`:
  - Dùng `getAuthenticatedUser()` + `AuthGuard`.
  - Lấy profile từ bảng `profiles` để render `AppShell` (displayName/avatar).
- `app/(app)/chat/page.tsx`:
  - UI khung chat theo theme “ledger paper”.
  - Có suggestion cards (ghi nợ/thu nợ/hỏi/báo cáo).
  - Input + send button hiện **disabled** (`Chat coming soon`).

## 4) AI pipeline — Stage 1 Extract Intent (TIP-003)
Mục tiêu: từ 1 câu tiếng Việt → JSON intent strict (Zod), **không resolve DB**, **không write business tables**.

### Files chính
- `src/lib/ai/intent-schema.ts`
  - Enum intent: `create_order`, `record_payment`, `create_purchase`, `query_debt`, `query_inventory`, `query_sales`, `edit_order`, `undo`, `small_talk`, `unknown`.
  - Output type `ExtractedIntent` gồm `entities` (customer/supplier/product/items/amount/time_range...), `missing_info`, `warnings`, `needs_confirmation`, `next_stage_hint`.
- `src/lib/ai/prompts/extract-intent.ts`
  - Prompt tiếng Việt với rules: không bịa, không tạo ID, normalize tiền (85k → 85000, 1tr2 → 1200000), trả đúng schema.
- `src/lib/ai/provider.ts`
  - Model mặc định `gpt-4.1-mini`; bắt buộc có `OPENAI_API_KEY`.
- `src/lib/ai/extract-intent.ts`
  - Validate input (trim, max 1000 chars).
  - `generateText` (AI SDK) + `Output.object({ schema })` → parse lại bằng `ExtractedIntentSchema`.
  - Throw `IntentExtractionError` với codes rõ ràng.

### API route
- `app/api/ai/extract-intent/route.ts` (POST)
  - Auth: `supabase.auth.getUser()`, nếu fail → `401`.
  - Body: `{ text: string }`.
  - Call `extractIntent({ rawText, ownerId: user.id })`.
  - Log vào `chat_messages`: 1 row role=user + 1 row role=assistant (intent).
  - Response: `{ ok: true, data: extracted }` hoặc `{ ok:false, error:{code,message} }`.

### Live test script
- `scripts/ai/test-extract-intent.ts`
  - Load env; nếu thiếu `OPENAI_API_KEY` thì skip.
  - Chạy một list example inputs và in JSON ra console.

## 5) Supabase integration (Next.js)
- `src/lib/supabase/client.ts`: browser client (anon).
- `src/lib/supabase/server.ts`: server client (SSR) dùng `next/headers` cookies.
- `src/lib/supabase/proxy.ts`: middleware-style session refresh (`updateSession`).
- `src/lib/supabase/admin.ts`: service role client (không persist session).

## 6) Database (TIP-002) — schema, RLS, views, tests
Nguồn chính: `supabase/migrations/*` + docs `docs/database/TIP-002_SCHEMA_NOTES.md`.

### Schema & principles
- Domain tables: **14 bảng** trong `public` (multi-tenant).
  - `profiles`, `customers`, `products`, `suppliers`, `orders`, `order_items`, `payments`, `purchases`, `purchase_items`, `inventory_movements`, `audit_log`, `chat_messages`, `pending_previews`, `usage_events`.
- Multi-tenant isolation:
  - Bảng business có `owner_id` (UUID → `auth.users(id)`), RLS theo `owner_id = auth.uid()`.
- Append-only:
  - `inventory_movements`, `audit_log`, `usage_events` chỉ cho `INSERT/SELECT` và có trigger chặn UPDATE/DELETE.
- Denormalized fields:
  - `customers.debt_total` và `products.current_stock` có helper function sync:
    - `sync_customer_debt_total(owner_id, customer_id)`
    - `sync_product_current_stock(owner_id, product_id)`
- Views:
  - `v_customer_balances`, `v_inventory_status`, `v_daily_sales`, `v_usage_daily` đều `security_invoker=true`.

### Tests & seed
- `supabase/tests/tip002_verify.sql`: kiểm tra schema tồn tại, RLS enabled, views security_invoker, indexes, append-only constraints, invariants.
- `supabase/tests/tip002_acceptance.sql`: acceptance flow + kiểm tra multi-tenant isolation.
- `supabase/seed.sql`: seed nhỏ cho manual testing **nếu đã có local auth user** (nếu không có user thì seed skip).

## 7) Docs/roadmap trạng thái hiện tại
Nguồn chính:
- `y tuong/CONTEXT_HANDOFF_v4.md`: trạng thái TIPs + quy trình Vibecode + quyết định strategy (mom-only MVP).
- `y tuong/BLUEPRINT.md` + `y tuong/VISION.md`: kiến trúc 4 lớp + roadmap 5-stage pipeline.
- `docs/ai/TIP-003_AI_PIPELINE_NOTES.md`: mô tả Stage 1.
- `docs/database/TIP-002_SCHEMA_NOTES.md`: mô tả DB foundation.

Theo `CONTEXT_HANDOFF_v4.md`:
- TIP-001 ✅ DONE/APPROVED: scaffold Next.js + Supabase auth + app shell.
- TIP-002 ✅ DONE/APPROVED: DB foundation + RLS + views + helper functions + tests.
- TIP-003 ✅ DONE/APPROVED: AI Stage 1 Extract Intent + endpoint + live test.
- Next: **TIP-004 Entity Resolve + Alias Memory**.

## 8) Gaps / những phần chưa làm (đúng với roadmap)
- Chat UI hiện chưa có luồng chat thực sự (input disabled), chưa có `/api/chat` streaming.
- AI pipeline chưa có Stage 2–5:
  - Stage 2 entity resolve (customer/product/supplier matching + alias memory)
  - Stage 3 validate
  - Stage 4 preview + confirm (pending_previews)
  - Stage 5 commit transaction (stored functions/server actions/undo)
- Chưa thấy các trang CRUD customers/products (theo blueprint sẽ có thêm).

## 9) How to run (quick)
- App:
  - `pnpm dev`
- Quality:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
- Supabase local:
  - `supabase status`
  - `supabase db reset`
- AI stage 1 live test:
  - set env `OPENAI_API_KEY` (và optional `AI_MODEL`), rồi `pnpm ai:test-intent`.

> Note: file này không chứa giá trị secrets. Repo đã ignore `.env*.local` và `key.txt`.
