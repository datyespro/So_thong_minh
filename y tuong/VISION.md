
---

# 🎯 VISION DOCUMENT — Sổ Thông Minh

## 1. Tên & định vị

**Tên sản phẩm:** **Sổ Thông Minh** (working name — bác có thể đổi sau)

**Định vị 1 câu:**
> *Web app giúp mẹ bác bỏ sổ giấy — gõ một câu, AI ghi đơn, theo dõi công nợ, trả lời mọi câu hỏi về cửa hàng.*

**Không phải:**
- ❌ Không phải app kế toán
- ❌ Không phải POS (máy tính tiền)
- ❌ Không phải dashboard cho bác xem từ xa

**Là:**
- ✅ Sổ ghi chép thay sổ giấy
- ✅ AI hiểu tiếng Việt nói chuyện, trả lời câu hỏi
- ✅ Single user, web, dùng hàng ngày tại cửa hàng

---

## 2. Architecture — 4 lớp

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (Next.js 15 App Router + React)     │
│  • Chat UI (giống ChatGPT)                              │
│  • Confirm dialog với preview                           │
│  • Customer summary table (REQ-F07)                     │
│  • Order history + diff view (REQ-F05)                  │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  AI PIPELINE LAYER (Server Actions + OpenAI SDK)        │
│  Stage 1: Intent Extract (Structured Output)            │
│  Stage 2: Entity Resolve (alias matching)               │
│  Stage 3: Validate (math check, missing field)          │
│  Stage 4: Preview (build human-readable summary)        │
│  Stage 5: Execute (DB write trong transaction)          │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  DATA LAYER (Supabase Postgres + RLS)                   │
│  • 12 bảng (11 chính + chat_messages)                   │
│  • Append-only ledgers + soft delete                    │
│  • Denorm fields update trong transaction               │
└─────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│  INFRA LAYER (Vercel + Supabase Cloud)                  │
│  • Next.js host Vercel free tier                        │
│  • Supabase free tier (Postgres + Auth)                 │
│  • Nightly verify job (Vercel Cron hoặc Supabase Edge)  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Pipeline chi tiết — Một câu nói thành DB

```
"Anh Hưng mua 20 bao xi măng 80k trả 2tr"
         │
         ▼
┌────────────────────────────────────────┐
│ Stage 1 — OpenAI Structured Output     │
│ Input: text + system prompt + chat ctx │
│ Output: JSON intent (typed)            │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Stage 2 — Entity Resolve (Postgres)    │
│ • Tìm customer theo name + aliases     │
│ • Tìm product theo name + aliases      │
│ • >1 match → return needs_confirm      │
│ • 0 match → tạo mới (lazy)             │
└────────────────────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
  OK    needs_confirm
    │         │
    │         ▼
    │   ┌─────────────────────────────┐
    │   │ Render confirm dialog       │
    │   │ "Hưng nào? ① ② ③ ④ Mới"    │
    │   └─────────────────────────────┘
    ▼
┌────────────────────────────────────────┐
│ Stage 3 — Validate                     │
│ • Math: sum(items) == total?           │
│ • Required fields đủ?                  │
│ • Thiếu → AI hỏi lại                   │
└────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│ Stage 4 — Preview                      │
│ Build summary box hiển thị cho mẹ      │
│ "📋 Anh Hưng (CT A) — ... [✓ Lưu]"    │
└────────────────────────────────────────┘
         │
    [Mẹ bấm ✓ Lưu]
         │
         ▼
┌────────────────────────────────────────┐
│ Stage 5 — Execute (DB Transaction)     │
│ BEGIN                                  │
│   INSERT orders + order_items          │
│   INSERT inventory_movements           │
│   UPDATE customers SET debt_total      │
│   UPDATE products SET current_stock    │
│   INSERT audit_log                     │
│   INSERT chat_messages (assistant)     │
│ COMMIT                                 │
└────────────────────────────────────────┘
         │
         ▼
   Chat hiển thị: "✅ Đã lưu. [Undo 30s]"
```

---

## 4. User flow — Một ngày của mẹ

```
[Sáng 7h] Mở Safari → URL → Login email/password
            │
            ▼
       Chat homepage hiện history hôm qua + "Hôm nay làm gì?"
            │
       ┌────┴────┬─────────┬─────────┐
       ▼         ▼         ▼         ▼
   Ghi đơn   Ghi nhập   Tra cứu   Sửa đơn
   "Hưng     "Vừa nhập  "Hưng nợ  "Hôm qua
    mua..."   100 bao"   bao        Hưng
              ▼          nhiêu"    không..."
        AI confirm        ▼            ▼
        preview     "Hưng còn      Diff view
              ▼      4.2 triệu"   [Áp dụng]
        [✓ Lưu]                         │
              │                         │
              └──────────┬──────────────┘
                        ▼
                Chat tiếp tục
                        │
            [Tối 8h] Mẹ hỏi: "Hôm nay bán được bao nhiêu"
                        ▼
              "Hôm nay 12 đơn, doanh thu 18.5tr,
               thu được 12tr, nợ mới 6.5tr"
                        │
                        ▼
                  Mẹ đóng app
```

---

## 5. Tech stack chốt

| Layer | Tech | Version | Lý do |
|---|---|---|---|
| Framework | Next.js | 15.x App Router | Bác đã dùng ở Sales Dojo, reuse skill |
| Lang | TypeScript | 5.x strict | Type safety, đỡ bug |
| UI | Tailwind + shadcn/ui | latest | Đẹp nhanh, accessible sẵn |
| Form/Schema | Zod v4 | ^4.3.6 | Bác đã quen pattern này (memory) |
| DB | Supabase Postgres | latest | Free tier, có Auth + RLS sẵn |
| Auth | Supabase Auth (email+password) | latest | G2 chốt |
| LLM | OpenAI GPT-4o-mini | latest | Có Structured Outputs |
| LLM SDK | `openai` npm | ^4.x | Official SDK |
| Cron | Vercel Cron | latest | Verify job nightly 2h |
| Host | Vercel | free tier | Đủ cho MVP |
| Test | Vitest + Playwright | latest | Standard |

**KHÔNG dùng:**
- ❌ Server Components data fetching cho dynamic data (dùng Server Actions thay vì)
- ❌ tRPC, Prisma, Drizzle — overkill cho MVP, dùng Supabase client trực tiếp
- ❌ Redux/Zustand — chat state dùng React Server + URL state là đủ

---

## 6. Design direction — Mẹ 54 tuổi là center

**Nguyên tắc:**
1. **Font lớn** — base 18px (vs default 14–16px), số tiền 24–28px
2. **Contrast cao** — text đen đậm trên trắng, không xám nhạt
3. **Không icon trừu tượng** — luôn icon + chữ kèm theo
4. **Confirm rõ ràng** — preview to, nút to, màu xanh rõ
5. **Số tiền có dấu chấm** — `5.800.000đ`, không phải `5800000`
6. **Tiếng Việt thuần** — không dùng "submit", "confirm" → "Lưu", "Xác nhận"

**Palette đề xuất:**
- Primary: xanh dương đậm `#1e40af` (giống màu mực bút bi cũ)
- Success: xanh lá `#16a34a` (xác nhận)
- Danger: đỏ `#dc2626` (sửa, xoá, nợ)
- Background: trắng kem `#fffef9` (giống giấy sổ)
- Border: xám nhẹ `#e5e7eb` kẻ ô như sổ kế toán

**Typography:**
- Sans-serif: **Be Vietnam Pro** (đẹp tiếng Việt, free Google Fonts)
- Mono cho số tiền: **JetBrains Mono** (số align đẹp)

**Layout MVP:**
```
┌─────────────────────────────────────┐
│  Sổ Thông Minh                  ⚙️  │  Header gọn
├─────────────────────────────────────┤
│                                     │
│  [Bubble Mẹ] Hưng mua 20 bao...     │
│                                     │
│  [Bubble AI] 📋 Em hiểu là:         │
│   ┌─────────────────────────┐       │
│   │ Anh Hưng (CT A)         │       │
│   │ • 20 bao xi măng × 80k  │       │
│   │ Tổng 1.600.000đ         │       │
│   │ [✓ Lưu]   [✏️ Sửa]       │       │
│   └─────────────────────────┘       │
│                                     │
│  [Bubble Mẹ] Lưu                    │
│  [Bubble AI] ✅ Đã lưu. [Undo 30s]  │
│                                     │
├─────────────────────────────────────┤
│  💬 Gõ tin nhắn...           [Gửi]  │  Input box bottom
└─────────────────────────────────────┘
```

Có thêm 1 sidebar (collapse trên mobile):
- 🏠 Trang chủ (chat)
- 👥 Khách hàng (list)
- 📦 Sản phẩm (list)
- 📊 Báo cáo (placeholder Phase 2)

---

## 7. File structure đề xuất

```
so-thong-minh/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (app)/
│   │   ├── chat/page.tsx               # main chat UI
│   │   ├── customers/page.tsx          # list + detail
│   │   ├── customers/[id]/page.tsx     # summary table F07
│   │   ├── products/page.tsx
│   │   ├── orders/[id]/page.tsx        # detail + edit history
│   │   └── layout.tsx                  # sidebar + auth check
│   └── api/
│       └── cron/verify/route.ts        # nightly verify job
│
├── src/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # browser client
│   │   │   ├── server.ts               # server client
│   │   │   └── types.ts                # generated DB types
│   │   ├── openai/
│   │   │   ├── client.ts
│   │   │   └── schemas.ts              # Zod schemas for structured output
│   │   └── validations/                # Zod schemas form-side
│   │
│   ├── ai/
│   │   ├── pipeline.ts                 # 5-stage orchestrator
│   │   ├── stage1-extract.ts
│   │   ├── stage2-resolve.ts
│   │   ├── stage3-validate.ts
│   │   ├── stage4-preview.ts
│   │   ├── stage5-execute.ts
│   │   └── prompts/
│   │       ├── system-prompt.md
│   │       └── examples.md             # few-shot examples
│   │
│   ├── actions/                        # Server Actions
│   │   ├── chat.ts                     # main chat endpoint
│   │   ├── confirm.ts                  # execute after preview
│   │   ├── undo.ts
│   │   └── edit-order.ts
│   │
│   ├── components/
│   │   ├── chat/
│   │   │   ├── chat-window.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── preview-card.tsx
│   │   │   └── input-box.tsx
│   │   ├── customer/
│   │   │   ├── summary-table.tsx       # REQ-F07
│   │   │   └── customer-list.tsx
│   │   ├── order/
│   │   │   ├── diff-view.tsx           # REQ-F05
│   │   │   └── order-detail.tsx
│   │   └── ui/                         # shadcn components
│   │
│   └── types/
│       └── domain.ts                   # Customer, Product, Order...
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_indexes.sql
│   │   └── 0003_rls_policies.sql
│   └── seed.sql                        # test data
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── BLUEPRINT.md
│   ├── RRI-REPORT.md                   # bản này em sẽ tổng hợp
│   └── X-RAY.md                        # handover doc sau MVP
│
└── package.json
```

---

## 8. Task decomposition preview — Em dự kiến 10 TIPs

```
TIP-001: Scaffold + Auth
  ├── Next.js 15 + TS + Tailwind + shadcn setup
  ├── Supabase project + connect
  ├── Login/logout flow (email + password)
  └── Layout với sidebar
        ▼
TIP-002: Database schema
  ├── 12 bảng migrations
  ├── RLS policies (owner_id check)
  ├── Indexes (customer_id, owner_id, created_at)
  └── Seed data test
        ▼
TIP-003: AI Pipeline foundation
  ├── OpenAI client wrapper (provider abstraction)
  ├── Structured Output schemas (Zod)
  ├── System prompt v1 + few-shot examples
  └── Stage 1 (extract intent) — testable standalone
        ▼
TIP-004: Entity Resolve (Stage 2)
  ├── Customer matching (name + aliases + fuzzy)
  ├── Product matching
  ├── needs_confirm flow when >1 match
  └── Lazy create logic
        ▼
TIP-005: Chat UI + Preview Card
  ├── Chat window component
  ├── Message bubbles
  ├── Preview card với diff
  ├── Confirm/Edit/Cancel buttons
  └── Undo timer 30s
        ▼
TIP-006: Execute (Stage 3-4-5) + Server Actions
  ├── Validate logic
  ├── Build preview string
  ├── DB transaction wrapper
  ├── chat.ts action endpoint
  └── confirm.ts action endpoint
        ▼
TIP-007: Query features (REQ-F04, F06, F07)
  ├── "Anh Hưng nợ bao nhiêu" intent
  ├── "Hôm nay bán bao nhiêu" intent
  ├── Customer summary table component
  └── Render table in chat
        ▼
TIP-008: Edit Order (REQ-F05)
  ├── "Edit" intent detection
  ├── Find target order
  ├── Diff view component
  ├── Apply edit transaction (no hard delete)
  └── Audit log
        ▼
TIP-009: Verify Job + Polish
  ├── Vercel Cron route
  ├── Drift detection query
  ├── Email alert nếu drift
  └── Auto-fix nếu chênh nhỏ
        ▼
TIP-010: QA + Final polish
  ├── E2E test 7 flow chính
  ├── Mobile responsive test trên iPhone Safari
  ├── Font size + contrast review
  ├── Vietnamese number parsing edge cases
  └── Final deploy Vercel
```

Tổng effort ước tính: **~3-4 tuần** cho 1 Thợ (Claude Code) làm tuần tự.

---

## 9. Risks & mitigation

| Risk | Mitigation |
|---|---|
| AI parse sai số tiền tiếng Việt | Confirm preview luôn, mẹ thấy số trước khi lưu |
| Drift `debt_total` | Verify job nightly + audit log |
| Mẹ không hiểu UX | Em vẽ Loom recording demo, mẹ thử trực tiếp Round QA |
| OpenAI cost vượt dự tính | Track usage hàng ngày, alert nếu vượt $20/tháng |
| Mẹ bỏ app sau 2 tuần | Validation: bác ngồi với mẹ 30 phút sau khi launch, support trực tiếp |

---

## Câu hỏi cho bác về Vision

1. **Tên "Sổ Thông Minh"** OK hay đổi? *(Em vote giữ — đúng định vị, dễ nhớ.)*
2. **Design direction** (font lớn, kẻ ô như sổ, palette xanh-trắng-kem) OK?
3. **10 TIPs phân chia** ở trên hợp lý? Có TIP nào em nên gộp/tách?
4. **3-4 tuần effort** có khớp expectation bác không?

**Reply để chuyển bước:**
- **APPROVED** → em sang Step 4: Blueprint chi tiết + Contract
- **SỬA: ...** → bác chỉ phần cần đổi
- **HỎI THÊM: ...** → bác hỏi clarification trước khi quyết