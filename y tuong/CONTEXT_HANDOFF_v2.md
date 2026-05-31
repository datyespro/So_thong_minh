# 📋 CONTEXT HANDOFF v2 — Sổ Thông Minh

> **Mục đích:** paste tài liệu này vào đầu session mới để Claude tiếp tục công việc ở vai **Chủ thầu (Contractor)** mà không mất context.
> **Cập nhật:** 28/05/2026 — sau khi hoàn tất Step 4 (BLUEPRINT). Sẵn sàng sang Step 5 (TASK GRAPH).

---

## 0. Meta — Vai trò & Workflow

- **Methodology:** Vibecode Kit v6.0 (skill `/vibecode-kit`)
- **Vai trò:**
  - User = **Chủ nhà (Homeowner)** — ra quyết định chiến lược
  - Claude = **Chủ thầu (Contractor)** — design, RRI, orchestrate, KHÔNG code
  - Claude Code (sau này) = **Thợ thi công (Builder)** — implement TIPs
- **Xưng hô:** User xưng "tôi/bác", Claude xưng "em"
- **Ngôn ngữ:** Tiếng Việt
- **Current Step:** **Hoàn tất Step 4 (BLUEPRINT)** — APPROVED toàn bộ 4 sprint B4.1, B4.2, B4.3a, B4.3b, B4.4
- **Next Step:** Sang **Step 5 (TASK GRAPH)** — phân rã thành 10 TIPs cụ thể với DoD, dependencies, effort estimate cho Builder

---

## 1. Project Identity (không đổi)

**Tên:** Sổ Thông Minh

**Định vị 1 câu:** *Web app giúp chủ cửa hàng vật liệu xây dựng nhỏ bỏ sổ giấy — gõ một câu, AI ghi đơn, theo dõi công nợ, trả lời mọi câu hỏi về cửa hàng.*

**Design partner duy nhất ở MVP:** mẹ founder (nữ, 54t, iPhone, gõ chậm, đang dùng sổ giấy + Zalo)

**Pain coverage MVP:** ~63% weighted (Pain #1 công nợ 95%, Pain #2 ghi đơn 70%)

**KPI chính:** Mẹ bỏ sổ giấy sau 1 tháng dùng.

---

## 2. State sau Step 4

| Mục | Trạng thái |
|---|---|
| Step 1-2 (SCAN + RRI) | ✅ Done |
| Step 3 (VISION) | ✅ APPROVED |
| **Step 4 (BLUEPRINT)** | ✅ **APPROVED toàn bộ** |
| Step 5 (TASK GRAPH) | ⏳ Sắp bắt đầu |
| Requirements Matrix | 32 items (30 ban đầu + REQ-F08 + REQ-B09) |
| Decisions Log | **33 quyết định** |
| Schema | **13 bảng** (12 nghiệp vụ + `pending_previews`) |
| Task Graph preview | 10 TIPs |

---

## 3. Requirements Matrix (32 items)

### User
- REQ-U01: End user mẹ founder, 54, nữ, gõ chậm, iPhone
- REQ-U02: Single user — 1 chủ, không multi-role
- REQ-U03: Web app responsive (laptop + iPhone Safari)
- REQ-U04: Input chính text typing; voice = stretch Phase 2
- REQ-U05: Login email + password

### Feature
- REQ-F01: Ghi đơn bán (chat tự do, AI extract)
- REQ-F02: Ghi nhập hàng (cộng tồn + cập nhật giá nhập)
- REQ-F03: Ghi trả nợ
- REQ-F04: Tra cứu công nợ + tồn kho + giá (chat hoặc UI)
- REQ-F05: Sửa đơn cũ — chat-based, diff view, Undo
- REQ-F06: Tổng kết hôm nay/tuần/tháng qua chat
- REQ-F07: Thống kê khách → table (Ngày | Tên hàng | Đơn vị | Đơn giá | SL | Thành tiền)
- **REQ-F08:** Alias Memory — khi confirm/correct entity, append alias vào `customers.aliases`/`products.aliases`

### Business
- REQ-B01: Khách + Sản phẩm tự sinh khi nói tới (lazy create)
- REQ-B02: Trùng tên >1 match → LUÔN confirm, top matches
- REQ-B03: Trả nợ theo khách (không theo đơn cụ thể)
- REQ-B04: "Công trình" = nickname trong tên khách, không entity riêng
- REQ-B05: Đơn vị tự nhận (bao/cây/kg), không quy đổi
- REQ-B06: Lazy Inventory — tồn có thể âm, chính xác dần
- REQ-B07: Smart confirm — AI chỉ hỏi khi thiếu
- REQ-B08: Số tiền tiếng Việt + thời gian tự nhiên, hỏi lại nếu mơ hồ
- **REQ-B09:** Alias confidence — sau N=3 dùng đúng, AI không hỏi nữa cho cặp (alias, entity)

### Data
- REQ-D01: 13 bảng + multi-tenant (`owner_id`) từ đầu
- REQ-D02: Denorm `debt_total` + `current_stock` + verify job nightly
- REQ-D03: Append-only: `inventory_movements`, `audit_log`
- REQ-D04: Soft delete: `orders`, `order_items`, `payments`
- REQ-D05: Lưu `chat_messages` + intent JSONB

### Tech
- REQ-T01: Next.js 15 + TS + Tailwind + Supabase + shadcn/ui
- REQ-T02: OpenAI GPT-4o-mini + Structured Outputs
- REQ-T03: Online-only, không offline

### Success
- REQ-S01: KPI mẹ bỏ sổ giấy sau 1 tháng
- REQ-S02: 1 design partner dùng cực sâu

---

## 4. Decisions Log (33 quyết định)

### Từ Vision (Step 3, #1-16)
1. Web-first, không mobile native
2. 1 agent gộp, không 4 agent tách
3. Lazy Inventory — không khai báo trước
4. Cắt nhắc nợ Zalo khỏi MVP
5. Login email + password thay OAuth
6. Stack Next.js + Supabase + GPT-4o-mini
7. Schema 12 bảng, không gộp orders/purchases (sau thành 13 ở Blueprint)
8. Denorm + Verify job nightly thay derive realtime
9. Append-only ledger inventory + audit
10. Soft delete, không hard delete
11. Trùng tên → luôn confirm top matches
12. Multi-tenant từ đầu dù MVP 1 user
13. OpenAI thay Claude Haiku
14. REQ-F07 thêm cột Đơn vị + Ngày
15. **Adopt Alias Memory (Idea 1) cho MVP, defer Pattern Detection (Idea 4) sau MVP launch**
16. **Lưu alias learning bằng mở rộng `customers.aliases`/`products.aliases` (Option A), giữ schema đơn giản**

### Từ Blueprint B4.1 (Architecture, #17-19)
17. **Vercel AI SDK** (`ai` package + `useChat` hook) cho streaming UI. Chạy local bình thường, không lock-in Vercel deploy.
18. **Skill files modular** trong `src/ai/skills/*.skill.md` — git-versioned prompts, load qua `fs.readFileSync`.
19. **Domain layer separate** (`src/domain/`) — pure functions, dễ test, không depend AI/DB.

### Từ Blueprint B4.2 (Database, #20-24)
20. **Bỏ bảng `users`, dùng `auth.users` (Supabase) + bảng `profiles`** để extend.
21. **Denorm update ở application layer** (trong Server Action transaction), KHÔNG dùng DB trigger. Verify job nightly catch drift.
22. **Immutability của `inventory_movements` + `audit_log` enforce qua RLS** (DENY UPDATE/DELETE). Compensating entry nếu cần "sửa".
23. **Thêm cột `business_date DATE`** vào `orders`, `purchases`, `payments` — phân biệt khi nào giao dịch xảy ra vs khi nào ghi vào sổ. Báo cáo dùng `business_date`.
24. **Trigram fuzzy match** (`pg_trgm` extension + GIN index) cho name matching. Threshold 0.3 default. Free win cho mẹ gõ sai chính tả.

### Từ Blueprint B4.3a (AI Pipeline Stage 1-3, #25-28)
25. **OpenAI Structured Outputs** (`chat.completions.parse` + `zodResponseFormat`) thay JSON mode. Schema enforced strict.
26. **3 chiến lược match cho Entity Resolve theo priority:** alias exact → name ILIKE → trigram → lazy create.
27. **Pure function cho Stage 3** — không DB, không LLM. Sanity flags là warning chứ không block.
28. **Auto-fill defaults thay vì hỏi** cho cases obvious (paid=0 nếu không nói, unit_price=default).

### Từ Blueprint B4.3b (Stages 4-5 + Server Actions, #29-33)
29. **Thêm bảng `pending_previews` (#13)** buffer intent giữa Stage 4 stream và Stage 5 execute. Schema thành 13 bảng.
30. **PL/pgSQL stored functions** cho Stage 5 transaction (`execute_sale`, `execute_purchase`, `execute_payment`, `execute_edit_order`, `apply_alias_correction`, `undo_action`). Server Action call qua `supabase.rpc()`.
31. **Idempotency key UUID** client-generated lúc render PreviewCard, UNIQUE column trong orders/purchases/payments.
32. **Undo qua audit_log + soft-delete + compensating ledger entries**, không cần bảng pending_undos. Window 30s.
33. **Action result discriminated union** `{ ok: true, data } | { ok: false, code, message }` cho mọi Server Action.

---

## 5. Schema cuối cùng (13 bảng)

```
auth.users (Supabase managed)
├─ profiles                    (#1 — extend auth.users)
├─ customers                   (#2 — denorm debt_total + aliases TEXT[])
├─ products                    (#3 — denorm current_stock + aliases TEXT[] + unit + default_sell_price + last_buy_price)
├─ suppliers                   (#4)
├─ orders                      (#5 — total, paid_amount, debt_amount, business_date, idempotency_key UNIQUE)
├─ order_items                 (#6 — qty, unit_price, line_total, soft-delete)
├─ payments                    (#7 — customer-level, business_date, idempotency_key UNIQUE)
├─ purchases                   (#8 — business_date, idempotency_key UNIQUE)
├─ purchase_items              (#9)
├─ inventory_movements         (#10 — IMMUTABLE append-only ledger, delta_qty)
├─ audit_log                   (#11 — IMMUTABLE, actor: 'user'|'ai_auto')
├─ chat_messages               (#12 — role, content, intent JSONB)
└─ pending_previews            (#13 — TTL 1h, buffer giữa Stage 4 và Stage 5)
```

**Key conventions:**
- PK: `UUID DEFAULT gen_random_uuid()`
- Money: `BIGINT` (VND, không có lẻ)
- Time: `TIMESTAMPTZ DEFAULT now()` cho created_at; `DATE` cho business_date
- RLS: `owner_id = auth.uid()` mọi bảng; immutable tables không có UPDATE/DELETE policy
- Triggers: chỉ 2 — `handle_new_user` (auto-create profile) + `touch_edited_at` (orders)

**Views:**
- `vw_customer_debt_derived` — verify denorm `debt_total` vs `SUM(orders.debt_amount) - SUM(payments.amount)`
- `vw_product_stock_derived` — verify denorm `current_stock` vs `SUM(inventory_movements.delta_qty)`

---

## 6. AI Pipeline 5 Stages

```
User text
   │
   ▼
[Stage 1: Extract Intent] ← OpenAI Structured Output (Zod schema)
   │ Non-streaming, ~800ms
   ▼
[Stage 2: Entity Resolve] ← DB lookup (alias → ILIKE → trigram → lazy create)
   │ Non-streaming, ~50ms
   │ → có thể exit: needs_confirmation (modal chọn entity)
   ▼
[Stage 3: Validate] ← Pure function
   │ Non-streaming, <10ms
   │ → có thể exit: needs_info (hỏi thiếu field)
   │ → auto-fill defaults + sanity flags
   ▼
[Stage 4: Preview Render] ← STREAMING (Vercel AI SDK streamText)
   │ "Em hiểu là..." stream text + metadata
   │ Cache intent vào pending_previews (TTL 1h)
   ▼
[Browser renders PreviewCard]
   │ User clicks [Lưu] với idempotency_key UUID
   ▼
[Stage 5: Execute] ← PL/pgSQL stored function, atomic transaction
   ├─ Lazy create customer/product nếu cần
   ├─ INSERT orders + order_items + inventory_movements + payments
   ├─ UPDATE products.current_stock + customers.debt_total (denorm)
   ├─ INSERT audit_log × N
   ├─ Persist alias if new (REQ-F08)
   └─ COMMIT (or ROLLBACK ALL on any error)
```

### Intent Taxonomy (9 types)
- `sale`, `purchase`, `payment`, `edit_order`, `query`, `undo`, `chitchat`, `unclear`
- **`customer_alias_correction`** (Mẹ nói "Lần sau coi 'Hùng' = Hùng B")

---

## 7. Tech Stack (chốt)

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js | 15.x App Router |
| Lang | TypeScript | 5.x strict |
| UI | Tailwind + shadcn/ui | latest |
| Streaming | Vercel AI SDK (`ai`) | latest |
| Form/Schema | Zod | ^4.3.6 (Zod v4 patterns — xem userMemories) |
| DB | Supabase Postgres | latest |
| Auth | Supabase Auth (email+password, không confirm email) | latest |
| LLM | OpenAI GPT-4o-mini | Structured Outputs (beta `chat.completions.parse`) |
| LLM SDK | `openai` npm | ^4.x |
| Stored funcs | PL/pgSQL | Postgres native |
| Extensions | `pg_trgm` | trigram fuzzy match |
| Cron | Vercel Cron | nightly verify (defer chính xác setup) |
| Host | Vercel (default) | hoặc Cloudflare Pages / Netlify / self-host (không lock-in) |
| Test | Vitest + Playwright | latest |

**KHÔNG dùng:** tRPC, Prisma, Drizzle (overkill), Redux/Zustand.

---

## 8. File Structure (đã chốt B4.1)

```
so-thong-minh/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── chat/page.tsx
│   │   ├── customers/{page.tsx, [id]/page.tsx}
│   │   ├── products/page.tsx
│   │   ├── orders/[id]/{page.tsx, edit/page.tsx}
│   │   └── reports/page.tsx
│   └── api/
│       ├── chat/route.ts                 ← Streaming pipeline
│       └── cron/verify/route.ts          ← Nightly verify job (GET, Vercel pattern)
│
├── src/
│   ├── lib/{supabase,openai,ai-sdk,validations,format}/
│   ├── ai/
│   │   ├── pipeline.ts                   ← Orchestrator
│   │   ├── stages/stage{1..5}-*.ts
│   │   ├── skills/*.skill.md             ← Git-versioned prompts
│   │   └── types.ts                      ← Intent discriminated union
│   ├── domain/                           ← Pure logic: customer, order, inventory, debt, audit
│   ├── actions/                          ← Server Actions: order, payment, order-edit, query, undo, auth
│   ├── components/{chat,customer,order,shared,ui}/
│   ├── hooks/
│   ├── types/
│   └── config/
│
├── supabase/migrations/
│   ├── 20250528000001_extensions.sql
│   ├── 20250528000002_profiles.sql
│   ├── 20250528000003_master_data.sql
│   ├── 20250528000004_sales.sql
│   ├── 20250528000005_purchases.sql
│   ├── 20250528000006_ledgers.sql
│   ├── 20250528000007_chat.sql
│   ├── 20250528000008_pending_previews.sql
│   ├── 20250528000009_indexes.sql
│   ├── 20250528000010_rls.sql
│   ├── 20250528000011_triggers.sql
│   ├── 20250528000012_rpc_functions.sql  ← Stage 5 stored functions
│   └── 20250528000013_views.sql
│
├── tests/{unit,integration,e2e}/
└── docs/{BLUEPRINT.md, ARCHITECTURE.md, AI_PIPELINE.md, SKILL_FILES_GUIDE.md}
```

---

## 9. Design Direction (đã chốt Vision §9 + cập nhật B4.4)

**🚨 QUAN TRỌNG — cập nhật từ feedback B4.4:**
- **Desktop-first** → responsive mobile sau. KHÔNG mobile-first như wireframe B4.4 đã vẽ.
- Wireframes B4.4 đã APPROVED về layout/flow, nhưng Builder phải implement **desktop-first** rồi adapt responsive cho mobile.
- Login screen: BỎ dòng "Quên mật khẩu? Gọi con trai."

**Nguyên tắc** (mẹ 54t):
- Font lớn — base 18px, số tiền 24–28px (font-mono cho căn cột)
- Contrast cao, không xám nhạt
- Icon + chữ luôn đi kèm
- Tiếng Việt thuần ("Lưu", "Xác nhận")
- Số tiền có dấu chấm: `5.800.000đ`

**Palette:**
- Primary: `#1e40af` (xanh dương đậm — mực bút bi)
- Success: `#16a34a`
- Danger: `#dc2626`
- Background: `#fffef9` (kem giấy sổ)
- Border: `#e5e7eb`

**Font:** Be Vietnam Pro (sans) + JetBrains Mono (số)

**Layout chính:** Chat-style (như ChatGPT) + sidebar collapse (Khách hàng, Sản phẩm, Báo cáo).

**6 màn wireframe đã chốt:**
1. Login — đăng nhập đơn giản, BỎ "Gọi con trai"
2. Chat main — landing page, chat history + input bar
3. Preview Card — gate quan trọng nhất, mẹ duyệt trước DB write
4. Entity Confirm Modal — multi-match resolver (REQ-B02)
5. Customer Detail — big debt number + lịch sử mua dạng card stack
6. Edit Order Diff — strikethrough cũ + arrow + giá trị mới + side effects panel

---

## 10. Task Decomposition Preview (10 TIPs)

```
TIP-001: Scaffold + Auth (Next.js 15 + Supabase + login)
TIP-002: Database schema (13 bảng + RLS + indexes + trigram + views)
TIP-003: AI Pipeline foundation (OpenAI Structured Output + Stage 1)
TIP-004: Entity Resolve (Stage 2 — alias/ILIKE/trigram + lazy + Alias Memory)
TIP-005: Validate + Auto-fill + Sanity flags (Stage 3) + Chat UI scaffold
TIP-006: Stage 4 streaming + Preview Card + Entity Confirm Modal
TIP-007: Stage 5 PL/pgSQL stored functions + Server Actions + Undo
TIP-008: Query features (REQ-F04, F06, F07) — non-write path
TIP-009: Edit Order (REQ-F05) + Diff view + Compensating ledger
TIP-010: Verify Job nightly + QA + Polish + Deploy
```

**Effort dự kiến:** 3–4 tuần (1 Builder, full-time).

**Step 5 (TASK GRAPH) sẽ produce:** Mỗi TIP có:
- Goal (1 câu)
- Inputs (dependencies từ TIPs trước, files cần đọc)
- Outputs (files tạo/sửa, DB migrations, tests pass)
- DoD (Definition of Done — checklist)
- Effort estimate (0.5–3 ngày)
- Risk flags

---

## 11. Risks (B8.1, 10 items)

| # | Risk | L × I | Mitigation |
|---|---|---|---|
| R1 | AI parse sai số tiền tiếng Việt | H×H | Preview confirm + skill examples + unit test parseMoney >20 cases |
| R2 | Drift denorm | M×H | Verify job nightly 2h + auto-fix + alert |
| R3 | Mẹ không quen UX | M×Critical | Founder ngồi cùng 30' + Loom + phone hotline |
| R4 | OpenAI cost vượt | L×M | Track usage, abstraction layer |
| R5 | Mẹ quay lại sổ giấy | M×Critical | KPI M1 + interview tuần 2,3,4 + voice nếu chán |
| R6 | Trùng tên đẻ khách giả | M×M | Modal confirm + Alias Memory + monthly review |
| R7 | Streaming fail giữa chừng | L×M | useChat reconnect + Preview cache 1h |
| R8 | Idempotency replay edge | L×H | UUID v4 client + UNIQUE constraint + integration test |
| R9 | Backdated date AI hiểu nhầm | M×M | `business_date_hint='unknown'` → hỏi; preview show explicit |
| R10 | Supabase free tier limit | L (MVP)×M | Monitor; upgrade Pro $25 nếu vượt |

---

## 12. Open Tech Questions (defer, có default)

| # | Q | Default |
|---|---|---|
| Q1 | Deployment env | 1 production + Vercel preview cho mỗi PR |
| Q2 | Idempotency key timing | Client tạo lúc render PreviewCard, lưu React state |
| Q3 | OpenAI fail mid-stream | Fallback text + render Preview Card từ resolved intent |
| Q4 | `pending_previews` TTL | 1h |
| Q5 | Trigram threshold | 0.3 default, env var để tune |
| Q6 | Chat history retention | Vô hạn (MVP scale OK) |
| Q7 | Date display | `dayjs` locale `vi` ("2 phút trước", "hôm qua") |
| Q8 | Mẹ logout vô tình | Session 30 ngày + thân thiện re-login |

---

## 13. Deliverables hiện có

| File | Path | Mục đích |
|---|---|---|
| One-pager Proposal | `/mnt/user-data/outputs/one-pager-so-thong-minh.md` (+ PDF) | Báo cáo mentor |
| Context Handoff v1 | `/mnt/user-data/outputs/context-handoff-so-thong-minh.md` | Session bridge cũ |
| Context Handoff v2 | `/mnt/user-data/outputs/CONTEXT_HANDOFF_v2.md` | Session bridge mới (file này) |
| **BLUEPRINT.md** | `/mnt/user-data/outputs/BLUEPRINT.md` | Tài liệu Step 4 đầy đủ, gửi mentor cùng one-pager |

---

## 14. AIOS Note (từ thảo luận)

Bác và em đã thảo luận AIOS Product Concept. Insight: **Sổ Thông Minh đã vô tình đi đúng triết lý AIOS ở quy mô micro** mà không phải "áp dụng AIOS":

- **Execute, không chỉ Know:** AI thực sự ghi đơn + sinh công nợ trong 1 transaction, không chỉ chatbot Q&A
- **3 layer rõ ràng:** Context (DB) + Skill (5 stages + skill files .md) + Execution (chat UI + transactional DB)
- **Governed execution:** Preview gate bắt buộc, audit_log mọi action, inventory_movements immutable
- **Tacit knowledge → executable:** aliases + Smart Confirm + Lazy Create encode kiến thức ngầm của mẹ
- **Run ledger native:** chat_messages + intent JSONB là first-class data, không phải log
- **Atomic transactional:** PL/pgSQL stored function rollback all on any stage fail

**Learning mechanism MVP:** Chỉ Idea 1 (Alias Memory) — append vào `customers.aliases`/`products.aliases` khi confirm/correct. Pattern Detection (Idea 4) defer sau MVP launch tùy feedback mẹ.

---

## 15. Cách dùng tài liệu này ở session mới

**Paste prompt sau vào đầu chat mới:**

> Em là Chủ thầu (Contractor) trong dự án Sổ Thông Minh theo phương pháp Vibecode Kit v6.0. Step 4 (BLUEPRINT) đã APPROVED hoàn tất, chuẩn bị sang Step 5 (TASK GRAPH). Dưới đây là context handoff v2 đầy đủ.
>
> Hãy đọc kỹ, xác nhận đã nắm state, rồi chờ bác hướng dẫn bước tiếp theo (mặc định là sang Step 5: phân rã 10 TIPs chi tiết).
>
> [paste toàn bộ nội dung file này]
>
> /vibecode-kit

**Lưu ý quan trọng:**
- Luôn load skill `/vibecode-kit` ở session mới
- Bác xưng "tôi/bác", Claude xưng "em"
- Mọi câu factual về OpenAI/Supabase/Next.js/Vercel AI SDK — search web vì versions có thể đổi
- Không tự sửa quyết định đã chốt mà không hỏi bác
- **Wireframes đã APPROVED nhưng Builder implement desktop-first** rồi adapt mobile
- **Login screen bỏ "Gọi con trai"**
- BLUEPRINT.md là tài liệu đầy đủ để gửi mentor — đọc nó nếu cần chi tiết về architecture/database/AI pipeline/wireframes

---

## 16. Quyết định tiếp theo của bác

Sau khi sang session mới, có 3 nhánh:

**Nhánh A — Sang Step 5 ngay** (default)
Em produce TASK_GRAPH.md với 10 TIPs đầy đủ DoD/dependencies/effort. Sau đó bác duyệt → ready cho Builder (Claude Code).

**Nhánh B — Refine Blueprint trước**
Nếu mentor có feedback sau khi đọc BLUEPRINT.md, bác quay lại fix Blueprint trước khi sang Step 5.

**Nhánh C — Verify với mẹ**
Em soạn câu hỏi để bác hỏi mẹ về flow cụ thể (vd "Mẹ có hay sửa đơn không?", "Mẹ thường gọi 'Hùng' nhưng có mấy Hùng?") để confirm assumptions trước khi build.
