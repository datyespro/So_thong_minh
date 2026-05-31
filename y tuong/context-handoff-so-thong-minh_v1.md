# 📋 CONTEXT HANDOFF — Sổ Thông Minh

> **Mục đích:** paste tài liệu này vào đầu session mới để Claude tiếp tục công việc ở vai **Chủ thầu (Contractor)** mà không mất context.

---

## 0. Meta — Vai trò & Workflow

- **Methodology:** Vibecode Kit v6.0 (skill `/vibecode-kit`)
- **Vai trò:**
  - Người dùng = **Chủ nhà (Homeowner)** — ra quyết định chiến lược
  - Claude = **Chủ thầu (Contractor)** — design, RRI, orchestrate, KHÔNG code
  - Claude Code (sau này) = **Thợ thi công (Builder)** — implement TIPs
- **Xưng hô:** User xưng *"tôi"/"bác"*, Claude xưng *"em"*
- **Ngôn ngữ:** Tiếng Việt
- **Current Step:** Cuối **Step 3 (VISION)** — Vision đã được tạo, chưa nhận APPROVED. Đang ở giai đoạn refine one-pager cho mentor.
- **Next Step:** Bác duyệt Vision → sang **Step 4 (BLUEPRINT)** chi tiết.

---

## 1. Project Identity

**Tên:** Sổ Thông Minh

**Định vị 1 câu:** *Web app giúp chủ cửa hàng vật liệu xây dựng nhỏ bỏ sổ giấy — gõ một câu, AI ghi đơn, theo dõi công nợ, trả lời mọi câu hỏi về cửa hàng.*

**Đây là gì:** sổ ghi chép thay sổ giấy + AI hiểu tiếng Việt + governance-first (AI đề xuất, người dùng duyệt).

**Đây KHÔNG phải:** app kế toán, POS, dashboard cho founder xem từ xa.

---

## 2. Target User

**Design partner duy nhất ở MVP:** mẹ của founder (user)
- **Nữ, 54 tuổi**, chủ cửa hàng VLXD nhỏ
- Dùng **iPhone**, đánh máy chậm
- Đang quản lý bằng **sổ giấy + Zalo**
- Single user, không multi-role

**Target sau MVP:** chủ cửa hàng VLXD nhỏ Việt Nam, 35–60 tuổi, dùng smartphone cơ bản.

**Volume:** 100–500 đơn/tháng/cửa hàng.

---

## 3. Painpoint Analysis (đã chốt)

Phương pháp chấm: 3 trục (Tần suất × Tiền × Stress) → Score 1–10.

| # | Pain | Tần suất | Tiền | Stress | Score |
|---|---|---|---|---|:---:|
| 1 | **Công nợ — tra cứu "khách X nợ bao nhiêu"** | Cao (5–10/ngày) | Cao (sai = mất tiền, tranh chấp) | Rất cao | **10/10** |
| 2 | **Ghi đơn bán** khi bận, khách đông | Cực cao (10–30/ngày) | Trung bình | Cao | **9/10** |
| 3 | Nhắc nợ — soạn tin Zalo | Trung bình | Cao | Cao (ngại nhắn) | 8/10 |
| 4 | Tồn kho | Trung bình | Trung bình | Trung bình | 6/10 |
| 5 | Giá nhập / lợi nhuận | Thấp | Cao khi xảy ra | Thấp | 5/10 |
| 6 | Báo cáo cuối ngày/tháng | Thấp | Thấp | Trung bình | 4/10 |

**Insight chính:** "Ghi đơn" + "Công nợ" không tách được — mỗi đơn bán chịu sinh ra dòng công nợ. Giải 2 pain top = giải 45% trọng số.

**Pain coverage MVP:** **~63% weighted** (Pain #1: 95%, Pain #2: 70%, Pain #4: 55%, Pain #6: 65%; Pain #3: 25% — cắt nhắc nợ Zalo; Pain #5: 55%).

---

## 4. Requirements Matrix (chốt qua RRI 3 round)

| REQ-ID | Loại | Mô tả |
|---|---|---|
| REQ-U01 | User | End user: mẹ founder, 54, nữ, gõ chậm, dùng iPhone |
| REQ-U02 | User | Single user — 1 chủ dùng, không multi-role |
| REQ-U03 | User | Web app, responsive (laptop + iPhone Safari) |
| REQ-U04 | User | Input chính: text typing. Voice = stretch goal Phase 2 |
| REQ-U05 | User | Login email + password |
| REQ-F01 | Feature | Ghi đơn bán (chat tự do, AI extract) |
| REQ-F02 | Feature | Ghi nhập hàng (cộng tồn + cập nhật giá nhập gần nhất) |
| REQ-F03 | Feature | Ghi trả nợ |
| REQ-F04 | Feature | Tra cứu công nợ + tồn kho + giá nhập (chat hoặc UI) |
| REQ-F05 | Feature | Sửa đơn cũ — chat-based, có diff view, có Undo |
| REQ-F06 | Feature | Tổng kết hôm nay/tuần/tháng (qua chat) |
| REQ-F07 | Feature | Thống kê khách → bảng (Ngày | Tên hàng | Đơn vị | Đơn giá | SL | Thành tiền + tổng) |
| REQ-B01 | Business | Khách + Sản phẩm tự sinh khi nói tới — không khai báo trước |
| REQ-B02 | Business | Trùng tên >1 match → luôn confirm, hiện top matches |
| REQ-B03 | Business | Trả nợ theo khách (không theo đơn cụ thể) |
| REQ-B04 | Business | "Công trình" = nickname trong tên khách, không entity riêng |
| REQ-B05 | Business | Đơn vị tự nhận từ câu nói (bao/cây/kg), không quy đổi |
| REQ-B06 | Business | Lazy Inventory: tồn có thể âm, chính xác dần theo thời gian |
| REQ-B07 | Business | Smart confirm: AI chỉ hỏi lại khi thiếu thông tin |
| REQ-B08 | Business | Số tiền tiếng Việt + thời gian tự nhiên — AI parse, hỏi lại nếu mơ hồ |
| REQ-D01 | Data | 12 bảng + multi-tenant (`owner_id`) từ đầu |
| REQ-D02 | Data | Denorm `debt_total` + `current_stock` + **verify job nightly** |
| REQ-D03 | Data | Append-only: `inventory_movements`, `audit_log` |
| REQ-D04 | Data | Soft delete: `orders`, `order_items`, `payments` |
| REQ-D05 | Data | Lưu `chat_messages` + intent JSON để debug |
| REQ-T01 | Tech | Stack: Next.js 15 + TS + Tailwind + Supabase + shadcn/ui |
| REQ-T02 | Tech | LLM: OpenAI GPT-4o-mini với Structured Outputs |
| REQ-T03 | Tech | Online-only — không offline |
| REQ-S01 | Success | KPI: design partner bỏ sổ giấy sau 1 tháng |
| REQ-S02 | Success | 1 design partner dùng cực sâu |

---

## 5. Decisions Log (14 quyết định chính)

1. **Web-first**, không mobile native (do user F1)
2. **1 agent gộp**, không phải 4 agent tách (do painpoint analysis)
3. **Lazy Inventory** — không khai báo trước (do REQ-B06)
4. **Cắt nhắc nợ Zalo** khỏi MVP (do user F4)
5. **Login email + password** thay OAuth (do user G2)
6. **Stack Next.js + Supabase + OpenAI GPT-4o-mini** (do user G1)
7. **Schema 12 bảng**, không gộp orders/purchases (do user xác nhận)
8. **Denorm + Verify job nightly** thay derive realtime (do user chọn b)
9. **Append-only ledger** cho inventory + audit
10. **Soft delete**, không hard delete
11. **Trùng tên → luôn confirm** top matches (do user H3.a)
12. **Multi-tenant từ đầu** dù MVP chỉ 1 user
13. **OpenAI thay Claude Haiku** (user có sẵn API)
14. **REQ-F07 bảng có cột Đơn vị + Ngày tháng năm** (user thêm)

---

## 6. Schema 12 bảng (đã chốt)

```sql
-- 1. users (owner — multi-tenant)
users (id, email, password_hash, name, created_at)

-- 2. customers
customers (
  id, owner_id, name, 
  aliases TEXT[],          -- ["Hùng", "anh Hùng A"]
  phone, 
  debt_total BIGINT,       -- DENORM, update trong cùng transaction
  created_at, deleted_at
)

-- 3. products
products (
  id, owner_id, name,
  aliases TEXT[],
  unit TEXT,                       -- "bao", "cây", "kg", "m"
  default_sell_price BIGINT,
  last_buy_price BIGINT NULL,
  current_stock INTEGER,           -- DENORM
  created_at, deleted_at
)

-- 4. suppliers
suppliers (id, owner_id, name, phone, created_at)

-- 5. orders
orders (
  id, owner_id, customer_id,
  total, paid_amount, debt_amount,
  created_at, edited_at, deleted_at
)

-- 6. order_items
order_items (
  id, order_id, product_id,
  qty, unit_price, line_total,
  deleted_at                      -- soft delete cho edit
)

-- 7. payments (trả nợ — tách riêng)
payments (
  id, owner_id, customer_id,
  amount, paid_at, note,
  deleted_at
)

-- 8. purchases (đơn nhập)
purchases (
  id, owner_id, supplier_id,
  total, purchased_at,
  deleted_at
)

-- 9. purchase_items
purchase_items (
  id, purchase_id, product_id,
  qty, unit_price, line_total,
  deleted_at
)

-- 10. inventory_movements — IMMUTABLE, append-only
inventory_movements (
  id, owner_id, product_id,
  delta_qty INTEGER,              -- + nhập, - bán, +/- chỉnh tay
  reason TEXT,                    -- 'sale' | 'purchase' | 'adjustment'
  ref_type TEXT, ref_id TEXT,
  note TEXT,
  created_at
)

-- 11. audit_log — IMMUTABLE
audit_log (
  id, owner_id,
  entity_type, entity_id,
  action,                         -- 'create' | 'edit' | 'soft_delete'
  old_value JSONB, new_value JSONB,
  actor TEXT,                     -- 'user' | 'ai_auto'
  created_at
)

-- 12. chat_messages
chat_messages (
  id, owner_id,
  role TEXT,                      -- 'user' | 'assistant'
  content TEXT,
  intent JSONB NULL,              -- AI extracted intent
  related_action_id TEXT NULL,
  created_at
)
```

---

## 7. AI Pipeline (5 stage)

```
User text → [1] Extract Intent → [2] Entity Resolve → [3] Validate → [4] Preview → [5] Execute
                ↑ OpenAI            ↑ alias matching   ↑ math check    ↑ confirm    ↑ DB transaction
                  Structured        + lazy create      + ask if missing  dialog       + audit log
                  Output (JSON)
```

**Mỗi câu user nói có thể tạo 5–8 dòng DB trong 1 transaction.** Nếu bất kỳ stage nào fail → rollback hết.

---

## 8. Tech Stack (chốt)

| Layer | Tech | Version |
|---|---|---|
| Framework | Next.js | 15.x App Router |
| Lang | TypeScript | 5.x strict |
| UI | Tailwind + shadcn/ui | latest |
| Form/Schema | Zod | ^4.3.6 |
| DB | Supabase Postgres | latest |
| Auth | Supabase Auth (email+password) | latest |
| LLM | OpenAI GPT-4o-mini | + Structured Outputs |
| LLM SDK | `openai` npm | ^4.x |
| Cron | Vercel Cron | for nightly verify |
| Host | Vercel | free tier |
| Test | Vitest + Playwright | latest |

**KHÔNG dùng:** tRPC, Prisma, Drizzle (overkill), Redux/Zustand.

---

## 9. Design Direction

**Nguyên tắc** (mẹ 54 tuổi là center):
- Font lớn — base 18px, số tiền 24–28px
- Contrast cao, không xám nhạt
- Luôn icon + chữ kèm theo
- Tiếng Việt thuần ("Lưu", "Xác nhận", không "Submit", "Confirm")
- Số tiền có dấu chấm: `5.800.000đ`

**Palette:**
- Primary: `#1e40af` (xanh dương đậm — mực bút bi)
- Success: `#16a34a`
- Danger: `#dc2626`
- Background: `#fffef9` (kem giấy sổ)
- Border: `#e5e7eb`

**Font:** Be Vietnam Pro (sans) + JetBrains Mono (số)

**Layout:** Chat-style chính (như ChatGPT) + sidebar (Khách hàng, Sản phẩm, Báo cáo).

---

## 10. Task Decomposition Preview (10 TIPs dự kiến)

```
TIP-001: Scaffold + Auth (Next.js + Supabase + login)
TIP-002: Database schema (12 bảng + RLS + indexes)
TIP-003: AI Pipeline foundation (OpenAI client + Stage 1 extract)
TIP-004: Entity Resolve (Stage 2 — matching + lazy create)
TIP-005: Chat UI + Preview Card
TIP-006: Execute (Stage 3-4-5) + Server Actions
TIP-007: Query features (REQ-F04, F06, F07)
TIP-008: Edit Order (REQ-F05) + diff view
TIP-009: Verify Job nightly + Polish
TIP-010: QA + Final polish + Deploy
```

**Effort dự kiến:** 3–4 tuần (1 Builder).

---

## 11. File Structure đề xuất

```
so-thong-minh/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/chat/page.tsx
│   ├── (app)/customers/[id]/page.tsx
│   └── api/cron/verify/route.ts
├── src/
│   ├── lib/{supabase,openai,validations}/
│   ├── ai/
│   │   ├── pipeline.ts
│   │   ├── stage1-extract.ts ... stage5-execute.ts
│   │   └── prompts/
│   ├── actions/ (Server Actions)
│   ├── components/{chat,customer,order,ui}/
│   └── types/domain.ts
├── supabase/migrations/
└── tests/{unit,integration,e2e}/
```

---

## 12. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| AI parse sai số tiền tiếng Việt | Confirm preview bắt buộc trước DB write |
| Drift dữ liệu (denorm sai) | Verify job nightly 2h sáng + alert |
| Mẹ gõ chậm → quay lại sổ giấy | Câu lệnh tự nhiên ngắn; voice ở Phase 2 |
| Mẹ không quen UX | Founder ngồi cùng 30 phút sau launch + Loom |
| OpenAI cost vượt | Track usage; abstraction layer đổi provider |

---

## 13. What's IN / OUT of MVP

**IN:**
- 7 use case F01–F07
- Web app responsive
- Login email+password
- Single user, single store (schema multi-tenant sẵn)
- 12 bảng + denorm + verify job

**OUT (defer P2+):**
- Voice input
- Nhắc nợ Zalo SDK
- Multi-user, multi-store
- In hóa đơn, PDF, biểu đồ, Excel
- OCR sổ giấy cũ
- Lãi gộp / phân tích lợi nhuận

---

## 14. Open Questions / Pending

- [ ] Vision document chưa nhận **APPROVED** explicit — bác đang ở giai đoạn refine one-pager cho mentor trước khi quyết
- [ ] One-pager đã có 2 ước tính tài chính (5–10tr/tháng thất thoát công nợ, 2–8tr/tháng mất do bỏ sót đơn) — bác có thể muốn verify với mẹ trước khi gửi mentor
- [ ] Sau khi mentor feedback → quyết sang Step 4 (Blueprint) hay sửa Vision

---

## 15. Deliverables hiện có

| File | Path | Mục đích |
|---|---|---|
| One-pager Proposal | `/mnt/user-data/outputs/one-pager-so-thong-minh.md` | Báo cáo mentor |
| Context Handoff (file này) | `/mnt/user-data/outputs/context-handoff-so-thong-minh.md` | Paste vào session mới |

---

## 16. Cách dùng tài liệu này ở session mới

**Paste prompt sau vào đầu chat mới:**

> Em là Chủ thầu (Contractor) trong dự án Sổ Thông Minh theo phương pháp Vibecode Kit v6.0. Dưới đây là context handoff đầy đủ từ session trước. Hãy đọc kỹ, xác nhận bác đã nắm được state hiện tại, rồi chờ bác hướng dẫn bước tiếp theo (có thể là: tiếp tục refine Vision, hoặc sang Step 4 Blueprint, hoặc sửa one-pager).
>
> [paste toàn bộ nội dung file này]
>
> /vibecode-kit

**Lưu ý quan trọng:**
- Luôn load skill `/vibecode-kit` ở session mới
- Bác xưng "tôi/bác", Claude xưng "em"
- Mọi câu hỏi factual về OpenAI/Supabase/Next.js — Claude phải search web vì versions có thể đổi
- Không tự sửa quyết định đã chốt mà không hỏi bác
