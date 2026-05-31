# 📐 BLUEPRINT — Sổ Thông Minh (Step 4 final)

> Tài liệu Blueprint hoàn chỉnh, gói gọn 4 sprint B4.1 → B4.4. Đầu vào cho Step 5 (Task Graph) và Builder (Claude Code).
>
> **Project:** Sổ Thông Minh — Web app thay sổ giấy cho chủ cửa hàng VLXD nhỏ, AI ghi đơn + công nợ + tra cứu, governance-first.
> **Methodology:** Vibecode Kit v6.0
> **Status:** Step 4 APPROVED (28/05/2026). Sẵn sàng Step 5.

---

## Mục lục

1. [System Architecture](#1-system-architecture)
2. [Database Blueprint](#2-database-blueprint)
3. [AI Pipeline (5 Stages)](#3-ai-pipeline-5-stages)
4. [Server Actions & API Contracts](#4-server-actions--api-contracts)
5. [UI Wireframes](#5-ui-wireframes-6-screens)
6. [File Structure](#6-file-structure)
7. [Validation & Test Strategy](#7-validation--test-strategy)
8. [Risks & Open Tech Questions](#8-risks--open-tech-questions)
9. [Decisions Log (33 decisions)](#9-decisions-log)

---

## 1. System Architecture

### 1.1 — Kiến trúc 4 lớp

```
┌──────────────────────────────────────────────────────────────────────┐
│  L4 — PRESENTATION (Next.js 15 App Router, React Client Components)  │
│  • Chat Surface (useChat + Vercel AI SDK)                            │
│  • Customer/Product pages                                            │
│  • Edit Order + Diff View                                            │
└──────────────────────────────────────────────────────────────────────┘
                              ▲   ▲
                Server Action │   │ Streaming Route Handler (POST /api/chat)
                              │   │
┌──────────────────────────────────────────────────────────────────────┐
│  L3 — APPLICATION (Server Actions + Route Handlers)                  │
│  • /api/chat/route.ts        → Streaming AI Pipeline                 │
│  • actions/order.ts          → executePreviewAction (Stage 5)        │
│  • actions/payment.ts, order-edit.ts, undo.ts, query.ts              │
└──────────────────────────────────────────────────────────────────────┘
                              ▲   ▲
                              │   │
┌──────────────────────────────────────────────────────────────────────┐
│  L2 — DOMAIN / AI PIPELINE (5 Stages + Domain Logic)                 │
│  • ai/pipeline.ts           → Orchestrator                           │
│  • ai/stages/stage{1..5}-*  → 5 pipeline stages                      │
│  • ai/skills/*.skill.md     → Git-versioned prompt files             │
│  • domain/{customer,order,inventory,debt,audit}.ts (pure logic)      │
└──────────────────────────────────────────────────────────────────────┘
                              ▲   ▲
                              │   │
┌──────────────────────────────────────────────────────────────────────┐
│  L1 — DATA (Supabase Postgres + RLS + Auth)                          │
│  • 13 tables                                                         │
│  • RLS: owner_id = auth.uid()                                        │
│  • PL/pgSQL stored functions for Stage 5 transactions                │
└──────────────────────────────────────────────────────────────────────┘
                              ▲   ▲
                              │   │
┌──────────────────────────────────────────────────────────────────────┐
│  L0 — INFRA                                                          │
│  Vercel (host, cron) │ Supabase Cloud │ OpenAI API                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 — Streaming boundary

| Stage | Streaming? | Lý do |
|---|:-:|---|
| 1. Extract Intent | ❌ | Cần full JSON validate Zod |
| 2. Entity Resolve | ❌ | DB query thuần |
| 3. Validate | ❌ | Pure function |
| 4. Preview render | ✅ | Text "Em hiểu là:..." stream cho mượt |
| 5. Execute | ❌ | DB transaction, không có text |
| Query (F04, F06) | ✅ | Câu trả lời stream |

**Trade-off:** ~1-2s "thinking" silent trước stream. Giải bằng ghost text "Em đang đọc câu của cô..." khi user submit.

### 1.3 — Request flow (3 scenarios chính)

**A. Ghi đơn bán:**
```
User text → POST /api/chat
  → Stages 1-3 (~1s, không stream)
  → Cache pending_preview
  → Stage 4 STREAM "Em hiểu là..."
  → Browser render PreviewCard
  → User clicks [Lưu] với idempotency_key
  → Server Action executePreviewAction
  → supabase.rpc('execute_sale', ...) → atomic transaction
  → Success + Undo banner 30s
```

**B. Tra cứu (F04/F06):** Skip Stage 3-5, Stage 4 stream answer trực tiếp từ DB.

**C. Sửa đơn (F05):** Stage 2 tìm target order; nhiều match → modal chọn; Stage 4 stream diff view.

---

## 2. Database Blueprint

### 2.1 — Type conventions

| Khái niệm | Type | Lý do |
|---|---|---|
| Primary key | `UUID DEFAULT gen_random_uuid()` | Multi-tenant ready |
| Foreign key tới user | `UUID REFERENCES auth.users(id)` | Supabase Auth UUID native |
| Tiền (VND) | `BIGINT` | VND không có lẻ |
| Số lượng (qty) | `INTEGER` | Đủ cho VLXD |
| Tên/text | `TEXT` | Postgres linh hoạt |
| Aliases | `TEXT[]` | Native array + GIN index |
| Thời gian | `TIMESTAMPTZ DEFAULT now()` | UTC lưu, app render VN +7 |
| Business date | `DATE` | Phân biệt khi nào giao dịch xảy ra |
| JSON | `JSONB` | Indexable |
| Soft delete | `deleted_at TIMESTAMPTZ NULL` | NULL = active |

### 2.2 — 13 bảng (DDL tóm tắt)

**Group 1 — Identity:**
- `profiles` — extend `auth.users`, name + created_at

**Group 2 — Master data:**
- `customers` — name, aliases[], phone, debt_total BIGINT (DENORM), soft-delete
- `products` — name, aliases[], unit, default_sell_price, last_buy_price, current_stock INTEGER (DENORM, có thể âm), soft-delete
- `suppliers` — name, phone

**Group 3 — Sales:**
- `orders` — customer_id, total, paid_amount, debt_amount, business_date DATE, idempotency_key UUID UNIQUE, soft-delete
  - CHECK: `debt_amount = total - paid_amount`
- `order_items` — order_id, product_id, qty, unit_price, line_total, soft-delete
  - CHECK: `line_total = qty * unit_price`
- `payments` — customer_id, amount, business_date DATE, note, idempotency_key UUID UNIQUE, soft-delete

**Group 4 — Purchases:**
- `purchases` — supplier_id (nullable), total, business_date DATE, idempotency_key UNIQUE, soft-delete
- `purchase_items` — purchase_id, product_id, qty, unit_price, line_total, soft-delete

**Group 5 — Immutable ledgers:**
- `inventory_movements` — product_id, delta_qty (sign), reason CHECK IN ('sale','purchase','adjustment','edit_compensation'), ref_type, ref_id, note
- `audit_log` — entity_type, entity_id, action CHECK IN ('create','edit','soft_delete','restore','undo'), old_value JSONB, new_value JSONB, actor CHECK IN ('user','ai_auto')

**Group 6 — Chat:**
- `chat_messages` — role, content, intent JSONB, related_action_id, related_action_type

**Group 7 — Buffer:**
- `pending_previews` — id, owner_id, intent JSONB, resolved JSONB, expires_at (TTL 1h)

### 2.3 — Indexes

```sql
-- Tenant isolation
CREATE INDEX idx_customers_owner ON customers(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_owner ON products(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_owner_business_date ON orders(owner_id, business_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_owner_business_date ON payments(owner_id, business_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchases_owner_business_date ON purchases(owner_id, business_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_owner_created ON chat_messages(owner_id, created_at DESC);

-- Entity resolution (Stage 2 critical path)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_customers_aliases_gin ON customers USING GIN(aliases);
CREATE INDEX idx_products_aliases_gin ON products USING GIN(aliases);
CREATE INDEX idx_customers_name_trgm ON customers USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);

-- FK lookups, ledger queries, intent search GIN — xem migration files đầy đủ
```

### 2.4 — RLS Policies

**Pattern chuẩn cho mọi bảng có owner_id:**
```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read" ON customers FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "owner_insert" ON customers FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_update" ON customers FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
-- KHÔNG có DELETE policy → soft delete only
```

**Immutable tables** (`inventory_movements`, `audit_log`): chỉ SELECT + INSERT policies, không UPDATE/DELETE.

### 2.5 — Triggers (chỉ 2)

1. `handle_new_user` — auto-insert vào `profiles` khi user mới signup (AFTER INSERT trên `auth.users`)
2. `touch_edited_at` — auto-update `orders.edited_at` khi UPDATE (không phải INSERT)

**KHÔNG dùng trigger cho:** denorm, audit_log insert, inventory_movement. Application layer xử lý trong transaction.

### 2.6 — Views (cho Verify Job nightly)

```sql
CREATE VIEW vw_customer_debt_derived AS
  SELECT c.id, c.owner_id, c.debt_total AS denorm_debt,
    COALESCE((SELECT SUM(o.debt_amount) FROM orders o WHERE o.customer_id=c.id AND o.deleted_at IS NULL),0)
    - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.customer_id=c.id AND p.deleted_at IS NULL),0)
    AS derived_debt
  FROM customers c WHERE c.deleted_at IS NULL;

CREATE VIEW vw_product_stock_derived AS
  SELECT p.id, p.owner_id, p.current_stock AS denorm_stock,
    COALESCE((SELECT SUM(im.delta_qty) FROM inventory_movements im WHERE im.product_id=p.id),0) AS derived_stock
  FROM products p WHERE p.deleted_at IS NULL;
```

Cron job 2h sáng: `SELECT * FROM vw_customer_debt_derived WHERE denorm_debt <> derived_debt;` → log alert + auto-fix.

### 2.7 — Migration order

```
001_extensions.sql           ← pg_trgm
002_profiles.sql             ← + handle_new_user trigger
003_master_data.sql          ← customers, products, suppliers
004_sales.sql                ← orders, order_items, payments
005_purchases.sql            ← purchases, purchase_items
006_ledgers.sql              ← inventory_movements, audit_log
007_chat.sql                 ← chat_messages
008_pending_previews.sql     ← buffer table
009_indexes.sql              ← All indexes
010_rls.sql                  ← All RLS policies
011_triggers.sql             ← touch_edited_at
012_rpc_functions.sql        ← Stage 5 stored functions (xem §4)
013_views.sql                ← verify views
```

---

## 3. AI Pipeline (5 Stages)

### 3.1 — Intent Taxonomy (9 types)

Discriminated union với Zod v4:

```typescript
export const IntentSchema = z.discriminatedUnion('type', [
  SaleIntent,         // type: 'sale'
  PurchaseIntent,     // type: 'purchase'
  PaymentIntent,      // type: 'payment'
  EditOrderIntent,    // type: 'edit_order'
  QueryIntent,        // type: 'query' (with subject discriminated)
  UndoIntent,         // type: 'undo'
  ChitchatIntent,     // type: 'chitchat'
  UnclearIntent,      // type: 'unclear'
  CustomerAliasCorrectionIntent,  // type: 'customer_alias_correction'
]);
```

**Query subjects:** `customer_debt`, `product_stock`, `product_price`, `summary`, `customer_history`, `open_question`.

**SaleIntent example:**
```typescript
{
  type: 'sale',
  customer: { raw_text: 'anh Hùng' },
  items: [{ product_raw: 'xi măng', qty: 20, unit_hint: 'bao', unit_price: 80000 }],
  payment: { paid_amount: 1000000, explicit: true },
  business_date_hint: { kind: 'today' }
}
```

### 3.2 — Stage 1: Extract Intent

- **Tool:** OpenAI GPT-4o-mini, `chat.completions.parse` (beta) + `zodResponseFormat(IntentSchema)`
- **Temperature:** 0.1 (gần deterministic)
- **Max tokens:** 1500
- **Skill file:** `src/ai/skills/extract-intent.skill.md` — chứa quy tắc tiếng Việt + few-shot examples

**Quy tắc tiếng Việt trong skill file:**
- Số tiền: "5 triệu 8" → 5_800_000, "ba trăm rưởi" → 350_000, "2 củ" → 2_000_000
- Thời gian: "hôm qua" → `{ kind: 'yesterday' }`, không nói → `today`, không rõ → `unknown`
- Tên: KHÔNG chuẩn hoá — giữ nguyên raw_text, Stage 2 sẽ resolve
- "Hùng đưa 2tr" + không mua gì → `payment`, không phải `sale`

**Error modes:** PARSE_FAILED → retry 1 lần với temp 0.3; TIMEOUT >15s → user-friendly error; RATE_LIMIT → exponential backoff x2.

### 3.3 — Stage 2: Entity Resolve

**Priority order** cho mỗi raw_text:

1. **Alias exact match** — `customers.aliases @> ARRAY[lower(text)]`
2. **Name ILIKE** — `name ILIKE '%text%'`
3. **Trigram similarity** — `pg_trgm` với threshold 0.3
4. **Lazy create** — mark `isLazyCreated: true`, insert ở Stage 5

**Confirm logic (REQ-B02):** Bất kỳ stage nào trả >1 candidate → return `{ status: 'needs_confirmation', pending: {...} }` để render modal.

**RPC function:**
```sql
CREATE FUNCTION match_customer_trgm(p_owner UUID, p_text TEXT, p_threshold FLOAT, p_limit INT)
RETURNS TABLE (id UUID, name TEXT, sim FLOAT) AS $$
  SELECT id, name, similarity(name, p_text) AS sim
  FROM customers WHERE owner_id = p_owner AND deleted_at IS NULL
    AND similarity(name, p_text) > p_threshold
  ORDER BY sim DESC LIMIT p_limit;
$$ LANGUAGE sql STABLE;
```

**Alias Memory write (REQ-F08):** Sau khi user confirm match, Stage 5 (trong transaction) append raw_text vào `customers.aliases` nếu chưa có + audit_log.

### 3.4 — Stage 3: Validate

**Pure function, không DB, không LLM.**

**Validation rules:**

| Rule | Áp dụng | Action |
|---|---|---|
| Item có `unit_price` (từ Stage 1) hoặc `default_sell_price` | sale, purchase | Cả 2 null → hỏi giá |
| Item có `unit_hint` hoặc `products.unit` | sale, purchase | Cả 2 null → hỏi đơn vị |
| `paid_amount` ≤ `total` | sale | Vượt → hỏi |
| `payment.amount > 0` | payment | =0 → block |
| `business_date` không ở tương lai | all | Future → warn (không block) |
| EditOrder match được order target | edit_order | Không match → return list cho user chọn |

**Auto-fill defaults** (thay vì hỏi):
- `payment.paid_amount = null` → `0` (full credit, flag trong preview)
- `unit_price = null` → `products.default_sell_price` nếu có
- `business_date_hint = today` → today; `yesterday` → today - 1 day

**Sanity flags** (warning, không block):
- Đơn >50tr → "Đơn lớn, cô kiểm lại số tiền"
- Stock âm sau giao dịch → "Tồn xi măng sẽ âm 5 bao"
- Khách `debt_total > 20tr` → "Anh Hùng đang nợ 22tr — vẫn ghi tiếp?"
- Giá nhập khác `last_buy_price > 50%` → "Giá khác lần trước nhiều"

### 3.5 — Stage 4: Preview (Streaming)

**Tool:** Vercel AI SDK `streamText` qua `mergeIntoDataStream`.

**Skill file:** `src/ai/skills/preview-render.skill.md`

```markdown
## Mẫu (sale)
Em hiểu là:
- Khách: anh Hùng A
- 20 bao Xi măng PCB40 × 80.000đ = 1.600.000đ
- Đã trả: 1.000.000đ
- Còn nợ: 600.000đ
Cô bấm Lưu nếu đúng nhé.
```

**Cuối stream** emit metadata:
```typescript
dataStream.writeData({
  kind: 'preview_ready',
  preview_id: 'uuid-...',
  intent_type: 'sale',
  summary: { ... },         // structured để render PreviewCard
  warnings: [ ... ],
});
```

**Preview cache:** Lưu intent vào bảng `pending_previews` (TTL 1h). Không trust client gửi lại intent để execute.

### 3.6 — Stage 5: Execute (PL/pgSQL Stored Functions)

**Why PL/pgSQL:** Supabase JS client không hỗ trợ multi-statement transaction native. Stored function = thật sự atomic, 1 round-trip, generated types từ Supabase CLI.

**Functions:**

| Function | Input | Tx steps |
|---|---|---|
| `execute_sale` | sale intent + idempotency_key | Lazy-create customer/product → INSERT order + items + inventory_movements + payments → UPDATE denorm → audit_log → persist alias |
| `execute_purchase` | purchase intent | Similar; `delta_qty > 0`; UPDATE `products.last_buy_price` |
| `execute_payment` | payment intent | INSERT payment + UPDATE customers.debt_total + audit |
| `execute_edit_order` | edit_order intent + target_order_id | Soft-delete old items + INSERT new + compensating inventory_movements + recompute denorm + audit |
| `apply_alias_correction` | customer_id + new_alias | UPDATE aliases + audit |
| `undo_action` | audit_log_id + entity_type | Reverse within 30s window |

**Idempotency:** UUID v4 client-generated, UNIQUE column trong orders/purchases/payments. Replay detection: catch `23505` (unique violation) → return existing.

### 3.7 — Undo (30s window)

Cơ chế: Tận dụng `audit_log` + soft-delete + compensating ledger entries. Không cần bảng riêng.

```sql
CREATE FUNCTION undo_action(p_owner UUID, p_action_id UUID, p_action_type TEXT)
RETURNS JSONB ...
-- 1. Check window: audit_log entry < 30s
-- 2. Per entity type, reverse:
--    order: soft-delete order+items + compensating inventory_movements + revert denorm + soft-delete payment
--    payment: soft-delete + revert customer.debt_total
-- 3. INSERT audit_log action='undo'
```

---

## 4. Server Actions & API Contracts

### 4.1 — ActionResult discriminated union

```typescript
type ActionResult<T> = 
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };

type ActionErrorCode = 
  | 'unauthorized' | 'preview_not_found' | 'preview_expired'
  | 'idempotency_replay' | 'validation_failed' | 'db_error' | 'internal';
```

### 4.2 — Action signatures

| Action | Input | Output | Note |
|---|---|---|---|
| `executePreviewAction` | `{preview_id, idempotency_key}` | `{action_id, summary}` | Dispatch theo intent_type → RPC |
| `undoAction` | `actionId` | `{undone: boolean}` | Reverse trong 30s window |
| `askQuestionAction` | `question: string` | `string` | Non-streaming query path |
| `confirmEntityAction` | `{preview_id, field, chosen_id}` | `{updated_preview_id}` | Update pending_preview |
| `dismissPreviewAction` | `preview_id` | `void` | Mẹ "Bỏ qua" |
| `signInAction` | `{email, password}` | session | Supabase Auth (email confirm OFF) |

### 4.3 — Route handler `/api/chat/route.ts` (preview)

```typescript
export async function POST(req: Request) {
  const { messages } = await req.json();
  const user = await getCurrentUser();
  const userText = messages.at(-1).content;

  const pipelineResult = await runPipeline({
    ownerId: user.id,
    userText,
    recentMessages: messages.slice(-5),
    now: new Date(),
  });

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Branch: needs_confirmation / needs_info / unclear / chitchat / ready_to_preview
      // → Stage 4 streamText nếu ready
      // → emit { kind: 'preview_ready', preview_id, summary } cuối stream
    }
  });
}
```

### 4.4 — Error handling matrix

| Stage | Lỗi | User message | Recovery |
|---|---|---|---|
| 1 | OpenAI rate limit | "AI đang chậm, thử lại" | Retry x2 backoff |
| 1 | Timeout >15s | "Mất kết nối với AI" | Button "Thử lại" |
| 5 | Idempotency replay | "Đơn này đã lưu rồi" | Show existing |
| 5 | DB constraint fail | "Lỗi dữ liệu, gọi bác" | Alert + generic msg |
| 5 | RLS deny | "Phiên hết hạn" | Redirect login |
| Undo | Window expired | "Quá 30s, không hoàn được" | Edit option |

---

## 5. UI Wireframes (6 screens)

**🚨 IMPLEMENTATION NOTE:** Wireframes design mobile-first để show flow rõ. Builder phải implement **DESKTOP-FIRST** rồi adapt responsive cho mobile.

### 5.1 — Login

- Đơn giản: email + password + nút "Đăng nhập"
- Logo Sổ Thông Minh + tagline "Bỏ sổ giấy. Gõ một câu."
- **KHÔNG có "Quên mật khẩu? Gọi con trai"** (đã bỏ theo feedback)
- Sau login redirect `/chat`

### 5.2 — Chat main (landing)

- Top bar: hamburger | "Sổ Thông Minh" | avatar
- Chat area: date separators, user bubble (right, primary blue), AI bubble (left, outline)
- Số tiền dùng `font-mono` để cột thẳng hàng
- Input bar fixed bottom: text input + send button (44px tap)
- Sidebar collapse: Khách hàng | Sản phẩm | Báo cáo | Đăng xuất

### 5.3 — Preview Card (governance gate)

Đây là moment quan trọng nhất — mẹ duyệt trước DB write.

- Header: icon user + tên customer đã resolve
- Items list: tên + giá đơn vị + qty
- Tổng / Đã trả / **Còn nợ** (font lớn, màu đỏ)
- Warning chip vàng nếu sanity flag (vd đã nợ nhiều)
- 2 nút: **Lưu** (xanh, primary) | **Sửa** (outline)
- Input bar disabled cho đến khi mẹ quyết

### 5.4 — Entity Confirm Modal (REQ-B02)

Khi Stage 2 thấy >1 match:
- Header: "Em tìm thấy 2 khách 'Hùng' — cô chọn giúp:"
- Mỗi candidate: avatar 2 chữ + tên + subtitle (debt + số đơn để phân biệt)
- "+ Tạo mới: 'Hùng'" với border dashed (visual khác biệt)
- Hint cuối: "Lần sau chỉ cần nói 'Hùng A' hoặc 'Hùng công trình'" → gợi trồng alias

### 5.5 — Customer Detail (giải Pain #1)

- Header: back button + tên customer
- **Big debt number** chiếm 1/3 màn — đỏ, 32px, font-mono — Pain #1 satisfied trong 0.5s
- Quick actions: [Ghi trả] | [Gọi]
- Section "Lịch sử mua": cards stack (mobile friendly hơn table)
  - Mỗi card: ngày + nợ status (đỏ/xanh) + items + tổng + paid
- Nút "Xem tất cả 12 đơn"

### 5.6 — Edit Order Diff View (REQ-F05)

- User message: "Sửa đơn hôm qua đổi 20 thành 15 bao"
- AI response: "Sửa đơn 26/05 của anh Hùng A:"
- Diff rows: `~~20 bao~~ → **15 bao**` với arrow icon
- "Em cũng sẽ:" panel info (cộng lại 5 bao tồn kho + giảm công nợ 400k) → transparency về side effects
- 2 nút: [Áp dụng] (xanh) | [Hủy]

---

## 6. File Structure

```
so-thong-minh/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                    ← Sidebar + AuthGuard
│   │   ├── chat/page.tsx                 ← Default route
│   │   ├── customers/{page.tsx, [id]/page.tsx}
│   │   ├── products/page.tsx
│   │   ├── orders/[id]/{page.tsx, edit/page.tsx}
│   │   └── reports/page.tsx
│   ├── api/
│   │   ├── chat/route.ts                 ← POST stream
│   │   └── cron/verify/route.ts          ← GET nightly verify
│   ├── layout.tsx
│   └── globals.css
│
├── src/
│   ├── lib/
│   │   ├── supabase/{client.ts, server.ts, admin.ts}
│   │   ├── openai/client.ts
│   │   ├── ai-sdk/config.ts
│   │   ├── validations/{intent.ts, domain.ts, chat.ts}
│   │   └── format/{money.ts, date.ts}
│   │
│   ├── ai/
│   │   ├── pipeline.ts
│   │   ├── stages/
│   │   │   ├── stage1-extract-intent.ts
│   │   │   ├── stage2-entity-resolve.ts
│   │   │   ├── stage3-validate.ts
│   │   │   ├── stage4-preview.ts         ← Streaming
│   │   │   └── stage5-execute.ts         ← Thin wrapper, real work in RPC
│   │   ├── skills/                       ← Git-tracked .md prompts
│   │   │   ├── extract-intent.skill.md
│   │   │   ├── entity-resolve.skill.md
│   │   │   ├── validate.skill.md
│   │   │   ├── preview-render.skill.md
│   │   │   ├── query-answer.skill.md
│   │   │   └── business-rules.skill.md
│   │   └── types.ts                      ← Intent discriminated union
│   │
│   ├── domain/                           ← Pure logic (no DB, no AI)
│   │   ├── customer.ts                   ← Alias matching, lazy create
│   │   ├── order.ts                      ← Calc total, debt
│   │   ├── inventory.ts                  ← Movement rules
│   │   ├── debt.ts                       ← Payment allocation
│   │   └── audit.ts                      ← Audit log builder
│   │
│   ├── actions/                          ← Server Actions
│   │   ├── auth.ts
│   │   ├── order.ts                      ← executePreviewAction
│   │   ├── payment.ts
│   │   ├── order-edit.ts
│   │   ├── query.ts
│   │   └── undo.ts
│   │
│   ├── components/
│   │   ├── chat/                         ← ChatSurface, MessageBubble, PreviewCard, EntityConfirmModal, ThinkingIndicator
│   │   ├── customer/                     ← CustomerList, CustomerDetail, DebtSummary
│   │   ├── order/                        ← OrderCard, OrderDiff, UndoBanner
│   │   ├── shared/                       ← MoneyDisplay, EmptyState, AuthGuard
│   │   └── ui/                           ← shadcn/ui generated
│   │
│   ├── hooks/                            ← useChat, useUndo, useCurrentUser
│   ├── types/domain.ts
│   └── config/constants.ts               ← UNDO_WINDOW_SEC, MAX_RETRY, etc.
│
├── supabase/
│   ├── migrations/
│   │   └── [13 migration files — xem §2.7]
│   └── config.toml
│
├── tests/
│   ├── unit/{domain, format, ai-pipeline}/
│   ├── integration/{actions, pipeline}/
│   └── e2e/{happy-path-ghi-don, cong-no, sua-don}.spec.ts
│
├── docs/{BLUEPRINT.md, ARCHITECTURE.md, AI_PIPELINE.md, SKILL_FILES_GUIDE.md}
├── .env.local.example
├── next.config.ts, tailwind.config.ts, tsconfig.json
└── package.json
```

---

## 7. Validation & Test Strategy

### 7.1 — Test pyramid

```
       e2e (5–10, Playwright)        — Happy path mỗi flow
  integration (15–25, Vitest+test DB) — Server Actions + RPC
      unit (40–60, Vitest)            — Domain, format, validators
```

### 7.2 — Critical path tests

**Unit:**
- `parseMoney("5 triệu 8")` = 5_800_000
- `parseMoney("ba trăm rưởi")` = 350_000
- `calcDebt({total: 1.6M, paid: 1M})` = 600k
- `matchAlias("Hùng", customers[])` priority order
- Zod schema: SaleIntent reject thiếu items

**Integration:**
- `extractIntent("Hùng mua 20 bao xi măng 80k")` → SaleIntent (mocked OpenAI fixture)
- `execute_sale` RPC: insert đúng 5 dòng + denorm chính xác
- `execute_sale` idempotency replay → return existing
- `undo_action` 30s window → revert denorm
- Verify view (`vw_customer_debt_derived`) catch drift

**E2E:**
- Login → ghi đơn → tra cứu công nợ → sửa đơn → undo
- Entity confirm modal: 2 match → tap → preview render
- Streaming: AI text appears chunk-by-chunk

### 7.3 — Test DB strategy

3 môi trường:
1. **Local dev** — Supabase CLI local (`supabase start`)
2. **CI test** — Same Supabase CLI local, GitHub Actions
3. **Production** — Supabase Cloud free tier

Migration files chạy trên cả 3. Verify drift bằng `supabase db diff`.

### 7.4 — Manual QA cho mẹ (8 scenarios)

| # | Scenario | Pass criteria |
|---|---|---|
| 1 | Ghi đơn đơn giản | "Hùng mua 5 bao xi măng" → preview 400k |
| 2 | Ghi đơn trả 1 phần | "...trả 200k" → còn nợ 200k |
| 3 | Trùng tên | "Hùng mua..." → modal chọn |
| 4 | Tra cứu công nợ | "Hùng nợ bao nhiêu" → trả lời <2s |
| 5 | Sửa đơn | "Sửa hôm qua đổi 20 thành 15" → diff đúng |
| 6 | Undo 30s | Sau Lưu nhấn Undo → công nợ revert |
| 7 | Đăng nhập lại | Logout → login → chat history còn |
| 8 | Tổng kết ngày | "Hôm nay bán bao nhiêu" → đúng tổng |

---

## 8. Risks & Open Tech Questions

### 8.1 — Risk register

| # | Risk | L×I | Mitigation | Owner |
|---|---|:-:|---|---|
| R1 | AI parse sai số tiền tiếng Việt | H×H | Preview confirm + skill examples + unit test parseMoney >20 cases | Builder |
| R2 | Drift denorm | M×H | Verify job nightly 2h + auto-fix + alert | Builder |
| R3 | Mẹ không quen UX | M×Crit | Founder ngồi 30' + Loom + phone hotline | Founder |
| R4 | OpenAI cost vượt | L×M | Track usage + abstraction layer | Founder |
| R5 | Mẹ quay lại sổ giấy | M×Crit | KPI M1 + interview tuần 2,3,4 + voice nếu chán | Founder |
| R6 | Trùng tên đẻ khách giả | M×M | Modal confirm + Alias Memory + monthly review | Builder + Founder |
| R7 | Streaming fail giữa chừng | L×M | useChat reconnect + Preview cache 1h | Builder |
| R8 | Idempotency replay edge | L×H | UUID v4 client + UNIQUE constraint + integration test | Builder |
| R9 | Backdated date AI hiểu nhầm | M×M | `business_date_hint='unknown'` → hỏi; preview show explicit | Builder |
| R10 | Supabase free tier limit | L×M | Monitor; upgrade Pro $25 nếu vượt | Founder |

### 8.2 — Open Tech Questions (defer, có default)

| # | Q | Default |
|---|---|---|
| Q1 | Deployment env | 1 production + Vercel preview cho mỗi PR |
| Q2 | Idempotency key timing | Client tạo lúc render PreviewCard, React state |
| Q3 | OpenAI fail mid-stream | Fallback text + render Preview Card từ resolved intent |
| Q4 | `pending_previews` TTL | 1h |
| Q5 | Trigram threshold | 0.3 default, env var để tune |
| Q6 | Chat history retention | Vô hạn (MVP scale OK) |
| Q7 | Date display | `dayjs` locale `vi` |
| Q8 | Mẹ logout vô tình | Session 30 ngày + thân thiện re-login |

---

## 9. Decisions Log

### From Vision (Step 3, #1-16)
1. Web-first, không mobile native
2. 1 agent gộp
3. Lazy Inventory
4. Cắt nhắc nợ Zalo
5. Login email + password
6. Stack Next.js + Supabase + GPT-4o-mini
7. Schema (rev) 13 bảng
8. Denorm + Verify nightly
9. Append-only ledger
10. Soft delete
11. Trùng tên → luôn confirm
12. Multi-tenant từ đầu
13. OpenAI thay Claude Haiku
14. REQ-F07 cột Đơn vị + Ngày
15. Alias Memory MVP, defer Pattern Detection
16. Alias storage Option A (mở rộng aliases TEXT[])

### From Blueprint (Step 4, #17-33)
17. Vercel AI SDK + useChat
18. Skill files modular (.md, git-versioned)
19. Domain layer separate (pure functions)
20. profiles thay users (Supabase auth.users)
21. Denorm ở app layer, không trigger
22. Immutability qua RLS (DENY UPDATE/DELETE)
23. Cột `business_date DATE` (orders, purchases, payments)
24. Trigram fuzzy match (pg_trgm)
25. OpenAI Structured Outputs (zodResponseFormat)
26. Entity Resolve priority: alias→ILIKE→trigram→lazy
27. Pure function Stage 3 (sanity flags không block)
28. Auto-fill defaults thay vì hỏi
29. Thêm bảng `pending_previews` (#13)
30. PL/pgSQL stored functions cho Stage 5
31. Idempotency UUID client-generated, UNIQUE column
32. Undo qua audit_log + soft-delete + compensating
33. ActionResult discriminated union

---

## Phụ lục: AIOS Philosophy Alignment

Sổ Thông Minh đã vô tình đi đúng triết lý AIOS ở quy mô micro mà không phải "áp dụng AIOS":

- **Execute, không chỉ Know:** AI thực sự ghi đơn + sinh công nợ trong 1 transaction
- **3 layer rõ ràng:** Context (DB) + Skill (5 stages + .md files) + Execution (chat UI + transactional DB)
- **Governed execution:** Preview gate bắt buộc, audit_log mọi action, ledger immutable
- **Tacit knowledge → executable:** aliases + Smart Confirm + Lazy Create encode kiến thức ngầm của mẹ
- **Run ledger native:** chat_messages + intent JSONB là first-class data
- **Atomic transactional:** PL/pgSQL rollback all on any stage fail

**Learning mechanism MVP:** Idea 1 (Alias Memory) — append vào `customers.aliases`/`products.aliases` khi confirm. Pattern Detection (Idea 4) defer sau MVP launch.

---

*End of Blueprint. Ready for Step 5 (Task Graph).*
