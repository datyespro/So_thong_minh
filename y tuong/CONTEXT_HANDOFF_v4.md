# 📋 CONTEXT HANDOFF v4 — Sổ Thông Minh

> **Mục đích:** Paste tài liệu này vào đầu session mới để ChatGPT/Claude tiếp tục công việc ở vai **Chủ thầu (Contractor)** mà không mất context.
>
> **Cập nhật:** 28/05/2026 — sau khi TIP-002 và TIP-003 đã hoàn tất, test pass, được duyệt.
>
> **Thay thế:** CONTEXT_HANDOFF_v3.md. Có thể giữ v3 làm reference cũ.

---

## 0. Meta — Vai trò & Workflow

* **Methodology:** Vibecode Kit v6.0 / workflow Chủ nhà → Chủ thầu → Builder.
* **Vai trò:**

  * User = **Chủ nhà (Homeowner)** — ra quyết định chiến lược, test những phần Codex không test được.
  * ChatGPT/Claude Chat = **Chủ thầu (Contractor)** — design, RRI, orchestrate, viết TIP, review report, KHÔNG code trực tiếp.
  * Codex/Claude Code = **Builder/Thợ thi công** — implement TIPs, chạy test, báo cáo.
* **Xưng hô:** User xưng “tôi/bác”, assistant xưng “em”.
* **Ngôn ngữ:** Tiếng Việt.
* **Current Step:** **Phase 1 — Step 5 TASK GRAPH**

  * TIP-001 ✅ done
  * TIP-002 ✅ done + APPROVED
  * TIP-003 ✅ done + APPROVED, live AI test PASS
  * **Next:** Viết **TIP-004 — Entity Resolve + Alias Memory**
* **Quy tắc làm việc:**

  * Viết từng TIP một, không batch 10 TIP.
  * Mỗi TIP phải có: Goal, Scope, Inputs, Outputs, Implementation Steps, Acceptance Criteria dạng Gherkin, QA prompt cho Codex, report format.
  * Sau khi Builder làm xong, Codex phải test tối đa phần tự động được. User chỉ test tay phần Codex không test được.
  * Không chuyển TIP tiếp nếu TIP hiện tại có blocker.

---

## 1. Project Identity

**Tên:** Sổ Thông Minh

**Định vị 1 câu:** Web app giúp chủ cửa hàng vật liệu xây dựng nhỏ bỏ sổ giấy — gõ một câu, AI ghi đơn, theo dõi công nợ, trả lời mọi câu hỏi về cửa hàng.

**Design partner duy nhất ở MVP:** mẹ founder, 54 tuổi, dùng iPhone, gõ chậm, quen sổ giấy + Zalo.

**KPI chính:** Mẹ bỏ sổ giấy sau 1 tháng dùng. Week 6 verify.

---

## 2. Mentor Feedback & Strategy

Mentor feedback: Passed, nhưng Week-6 bar cao hơn — cần real shops beyond mom vẫn login, recording bills, asking questions daily at Week 6; mẹ ngừng quay lại sổ giấy; ít nhất một owner nói nếu lấy app đi họ sẽ unhappy.

### Quyết định đã chốt: Nhánh 1 — Mom-only, accept trượt gate mentor Week 6

**Logic:**

* 1 design partner dùng sâu > 5 partner dùng nông.
* Builder solo, recruit + onboard rộng sẽ làm chậm build.
* Mẹ bỏ được sổ giấy là proof of concept quan trọng nhất.

**Action:**

* Tập trung 100% vào mẹ trong 6 tuần MVP.
* Báo mentor sớm: ưu tiên depth thay vì breadth, recruit shop khác sau Week 6.
* Mở rộng từ Week 7+ / Phase 7.

Không đề xuất lại multi-shop trong MVP, vì đã chốt defer sang post-MVP.

---

## 3. Tooling & Environments

User có 3 Supabase environment:

1. **Supabase local**

   * Dùng để build/test chính.
   * Mọi TIP database phải test bằng local trước.
   * Dùng `supabase db reset`, Docker Postgres, tests SQL.

2. **Supabase dev cloud**

   * Tên dự kiến: `sotm-dev`.
   * Dùng sau khi local pass.
   * MCP có thể connect vào dev cloud nếu cần.

3. **Supabase production cloud**

   * Tên dự kiến: `sotm-prod`.
   * Tuyệt đối không dùng cho test TIP.
   * Không connect MCP vào production.
   * Chỉ đụng production ở deploy/release phase.

### Tooling đã chốt: Phương án A — Supabase CLI + Supabase MCP

| Tool         | Vai trò                                                   |
| ------------ | --------------------------------------------------------- |
| Supabase CLI | Local dev, migration files, `db reset`, schema versioning |
| Supabase MCP | AI-assisted schema/query trên local/dev cloud             |

**Quy tắc bảo mật MCP:**

* Chỉ kết nối local + `sotm-dev`.
* Không bao giờ connect `sotm-prod`.
* Mọi schema change phải có file `.sql` trong `supabase/migrations/`.
* MCP chỉ apply/query, không tạo schema “tàng hình”.

---

## 4. Requirements Matrix — Important MVP Requirements

Giữ 32 REQ cũ từ v2/v3.

### 3 REQ mới từ Phase 0

| REQ-ID  | Requirement                                                                                                   | Priority | Persona  |
| ------- | ------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| REQ-B11 | Multi-tenant isolation từ đầu, giữ owner_id + RLS dù MVP chỉ có mẹ                                            | P0       | Operator |
| REQ-D06 | Usage telemetry: log `{owner_id, event_type, timestamp}` cho login/ghi đơn/tra cứu/sửa đơn, không lưu content | P0       | Operator |
| REQ-S04 | Mẹ ngừng dùng sổ giấy ở Week 6, verify bằng ảnh sổ + interview thực địa, không chỉ tự khai                    | P0       | Success  |

### Defer sang Phase 7 / post-MVP

* REQ-U06 multi-shop user
* REQ-B10 onboarding self-service <15 phút
* REQ-F09 owner self-service settings
* REQ-S03 2-3 shop active Week 6
* REQ-S05 weekly interview cycle multi-shop

---

## 5. Database Schema Current State

TIP-002 đã hoàn tất và được duyệt.

Schema có **14 bảng**:

```text
auth.users
├─ profiles
├─ customers
├─ products
├─ suppliers
├─ orders
├─ order_items
├─ payments
├─ purchases
├─ purchase_items
├─ inventory_movements
├─ audit_log
├─ chat_messages
├─ pending_previews
└─ usage_events
```

### Important tables

* `usage_events`: append-only telemetry, không lưu content.
* `inventory_movements`: immutable ledger.
* `audit_log`: immutable audit trail.
* `pending_previews`: dùng ở Stage 4 Preview + Confirm, TTL 1h.
* `chat_messages`: lưu user/assistant messages cho chat history.

### Important views

* `v_customer_balances`
* `v_inventory_status`
* `v_daily_sales`
* `v_usage_daily`

All views phải có `security_invoker = true` để không bypass RLS.

### TIP-002 approved tests

Codex/Builder đã chạy:

```text
supabase status: PASS
supabase db reset: PASS
tip002_verify.sql: PASS
supabase db advisors: PASS
supabase db diff: PASS
tip002_acceptance.sql: PASS
```

Automated test results:

```text
Schema existence: PASS
RLS enabled: PASS
View security_invoker: PASS
Multi-tenant isolation: PASS
Append-only tables: PASS
Same-owner invariants: PASS
Debt sync: PASS
Stock sync: PASS
```

### Important note

User đã hỏi: “TIP tạo trên local/dev/prod?”
Đã chốt: TIP database tạo migration file trong local repo → test Supabase local → sau khi pass mới apply dev cloud → không đụng production.

---

## 6. TIP Status

| TIP     | Tên                                                       | Status            |
| ------- | --------------------------------------------------------- | ----------------- |
| TIP-001 | Scaffold + Auth                                           | ✅ DONE / APPROVED |
| TIP-002 | Database Schema                                           | ✅ DONE / APPROVED |
| TIP-003 | AI Pipeline Foundation + Stage 1 Extract Intent           | ✅ DONE / APPROVED |
| TIP-004 | Entity Resolve + Alias Memory                             | 🟡 NEXT           |
| TIP-005 | Stage 3 Validate + Chat UI Scaffold                       | ⏳                 |
| TIP-006 | Stage 4 Streaming + Preview Card + Entity Confirm Modal   | ⏳                 |
| TIP-007 | Stage 5 PL/pgSQL Stored Functions + Server Actions + Undo | ⏳                 |
| TIP-008 | Query Features F04/F06/F07                                | ⏳                 |
| TIP-009 | Edit Order + Diff View + Compensating Ledger              | ⏳                 |
| TIP-010 | Telemetry Dashboard + Verify Job + QA + Deploy            | ⏳                 |

---

## 7. TIP-001 Summary

**Status:** APPROVED.

**Goal:** Scaffold Next.js 15 + Supabase + Tailwind + shadcn/ui. Login email/password. Protected route shell.

**Important decisions:**

* Không signup form; user tạo manual.
* Không dùng deprecated `@supabase/auth-helpers-nextjs`.
* Có Supabase clients browser/server/admin.
* AuthGuard + protected route shell.
* ActionResult type.
* MCP không connect production.

---

## 8. TIP-002 Summary

**Status:** APPROVED.

**Files created/modified by Builder:**

* `supabase/migrations/20260528085609_tip002_domain_schema.sql`
* `supabase/migrations/20260528085711_tip002_rls_policies.sql`
* `supabase/migrations/20260528085717_tip002_views.sql`
* `supabase/migrations/20260528085721_tip002_helper_functions.sql`
* `supabase/seed.sql`
* `supabase/tests/tip002_verify.sql`
* `supabase/tests/tip002_acceptance.sql`
* `docs/database/TIP-002_SCHEMA_NOTES.md`

**Important implementation details:**

* 14 domain tables.
* Owner isolation via `owner_id`.
* RLS on every public domain table.
* Append-only triggers for:

  * `inventory_movements`
  * `audit_log`
  * `usage_events`
* Same-owner invariant triggers for child rows.
* Denormalized sync:

  * `customers.debt_total`
  * `products.current_stock`
* Views use `security_invoker = true`.

**QA result:** All pass. No issues found. Recommendation APPROVE. User accepted.

---

## 9. TIP-003 Summary

**Status:** APPROVED.

**Goal:** AI Pipeline Foundation + Stage 1 Extract Intent.

TIP-003 reads one Vietnamese shop-owner message and returns a strict `ExtractedIntent` object.

### Scope

Stage 1 only:

```text
User text
→ Stage 1 Extract Intent
→ Stage 2 Entity Resolve
→ Stage 3 Validate
→ Stage 4 Preview + Confirm
→ Stage 5 Commit transaction
```

TIP-003 does **not**:

* Resolve database IDs.
* Write `orders`.
* Write `payments`.
* Write `pending_previews`.
* Write `usage_events`.
* Commit business transactions.

### Files created/modified

* `src/lib/ai/intent-schema.ts`
* `src/lib/ai/prompts/extract-intent.ts`
* `src/lib/ai/provider.ts`
* `src/lib/ai/extract-intent.ts`
* `app/api/ai/extract-intent/route.ts`
* `scripts/ai/test-extract-intent.ts`
* tests for schema/extract/route
* `vitest.config.ts`
* `package.json`
* `pnpm-lock.yaml`
* AI notes doc

### Package changes

* Added `ai@6.0.191`
* Added `@ai-sdk/openai@3.0.65`
* Added dev deps:

  * `vitest@4.1.7`
  * `tsx@4.22.3`
* Added scripts:

  * `test`
  * `test:watch`
  * `typecheck`
  * `ai:test-intent`

### Intent enum

```text
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

### Main output fields

```text
intent
confidence
raw_text
normalized_text
language
entities.customer_name
entities.supplier_name
entities.product_name
entities.items
entities.amount
entities.payment_status
entities.payment_method
entities.order_reference
entities.business_date
entities.time_range
missing_info
warnings
needs_confirmation
next_stage_hint
```

### API route

`POST /api/ai/extract-intent`

Request:

```json
{ "text": "Bán cho cô Lan 10 bao xi măng 85k, nợ" }
```

Route behavior:

* Creates Supabase server client.
* Calls `auth.getUser()`.
* Returns 401 if unauthenticated.
* Calls `extractIntent({ rawText, ownerId: user.id })`.
* Inserts two `chat_messages` rows using owner_id = auth.uid().
* Returns `{ "ok": true, "data": ExtractedIntent }`.
* Does not use service-role client.
* Does not write business tables.

### Environment

Required for live AI:

```env
OPENAI_API_KEY=...
AI_MODEL=gpt-4.1-mini
```

`AI_MODEL` optional, defaults to `gpt-4.1-mini`.

---

## 10. TIP-003 Debug Story — Important

Initial live test failed:

```text
pnpm run ai:test-intent
Live AI intent test failed.
INTENT_EXTRACTION_FAILED
```

Root cause found by Codex:

OpenAI structured output rejected the generated JSON Schema. `ExtractedIntentSchema` used `z.default()` on fields like `time_range.kind`, `items`, `payment_status`, `missing_info`, `warnings`. AI SDK converted those to optional fields, but OpenAI strict response_format requires every property to be listed in `required`.

Safe debug output showed:

```text
AI_MODEL: gpt-4.1-mini
AI_APICallError: Invalid schema for response_format 'ExtractedIntent'...
Missing 'kind'.
```

No API key was printed.

### Fix

Codex changed:

* `src/lib/ai/intent-schema.ts`

  * Added `ExtractedIntentOutputSchema` without defaults for OpenAI structured output.
  * Kept `ExtractedIntentSchema` with defaults for app-side parsing.

* `src/lib/ai/extract-intent.ts`

  * Preserves original error as `cause`.
  * Uses generation-safe schema for `Output.object`.

* `scripts/ai/test-extract-intent.ts`

  * Added safe error logging.
  * Redacts key/token-like values.
  * Uses `loadEnvConfig(process.cwd())` before dynamic AI imports.

### Final live AI test result

Command:

```text
pnpm run ai:test-intent
```

PASS.

Live examples:

```text
“Bán cho cô Lan 10 bao xi măng 85k, nợ”
→ create_order, confidence 0.95

“Cô Lan trả 500k”
→ record_payment, confidence 0.95

“Còn bao nhiêu xi măng?”
→ query_inventory, confidence 0.95

“Hôm nay bán được bao nhiêu?”
→ query_sales, confidence 0.95

“Sửa đơn hôm qua của cô Lan thành 12 bao”
→ edit_order, confidence 0.95, missing_info: ["product_name"]

“Hoàn tác đơn vừa rồi”
→ undo, confidence 0.95
```

Final commands:

```text
pnpm run ai:test-intent: PASS
pnpm run lint: PASS
pnpm run typecheck: PASS
pnpm test: PASS, 3 files / 19 tests
pnpm run build: PASS
```

Conclusion:

```text
TIP-003 AI Pipeline Foundation + Stage 1 Extract Intent: APPROVED
Status: Done
Live AI test: PASS
Next: TIP-004 Entity Resolve + Alias Memory
```

---

## 11. User Testing Philosophy

User explicitly prefers:

> Những cái Codex test được thì đưa cho Codex test. Nếu Codex không test được thì tôi mới test. Nhất là mấy cái lệnh thì Codex test được.

So for every TIP:

* Put all terminal/CLI/unit/db tests into Codex QA prompt.
* User only does manual test for:

  * visual UX
  * real browser/auth session if Codex cannot
  * product judgment
  * AI output sanity if live subjective
  * testing with mẹ later

For TIP-002, Codex tested all commands and DB invariants.
For TIP-003, Codex tested lint/typecheck/unit/build and user/Codex ran live AI test after key config.

---

## 12. Next TIP — TIP-004 Entity Resolve + Alias Memory

Write this next.

### Expected purpose

TIP-004 should take `ExtractedIntent` from TIP-003 and resolve raw Vietnamese names into database entities owned by the current user.

Examples:

* “cô Lan” → customer row in `customers`
* “xi măng” → product row in `products`
* “nhà cung cấp A” → supplier row in `suppliers`

### Important scope for TIP-004

TIP-004 should do:

* Build entity resolver layer.
* Search owner-scoped `customers`, `products`, `suppliers`.
* Use aliases arrays:

  * `customers.aliases`
  * `products.aliases`
  * likely supplier aliases if present, or propose if schema supports.
* Use fuzzy-ish matching if already available, likely via `pg_trgm` / SQL search, but must respect RLS/owner_id.
* Return candidate lists and confidence.
* Support statuses:

  * `resolved`
  * `needs_confirmation`
  * `not_found`
  * `ambiguous`
* Add alias memory flow if user confirms an alias.
* Must not create order/payment/purchase yet.
* Must not write business transaction tables.
* May write alias updates only if explicitly part of alias memory and owner-scoped.
* Should be safe for multi-tenant isolation.

TIP-004 should **not** do:

* Validate whether full transaction is complete. That is TIP-005.
* Create pending preview. That is TIP-006.
* Commit orders/payments/inventory movements. That is TIP-007.
* Query answer generation. That is TIP-008.
* Edit order flow. That is TIP-009.

### TIP-004 likely outputs

Potential files, but Contractor should decide after checking existing project conventions:

```text
src/lib/ai/resolve-schema.ts
src/lib/ai/entity-resolver.ts
src/lib/ai/resolve-intent.ts
app/api/ai/resolve-entities/route.ts
tests for resolver
scripts/ai/test-resolve-entities.ts
docs/ai/TIP-004_ENTITY_RESOLVE_NOTES.md
```

### TIP-004 must include Codex QA prompt

Codex should test:

* lint
* typecheck
* unit tests
* build
* Supabase local reset
* seeded entity resolve tests
* RLS isolation in resolver
* no cross-owner candidates
* alias matching
* ambiguous match handling
* not_found handling
* no writes to orders/payments/pending_previews

---

## 13. Suggested opening prompt for new context window

Paste this first:

```text
Em là Chủ thầu (Contractor) trong dự án Sổ Thông Minh theo phương pháp Vibecode Kit v6.0.

Hãy đọc kỹ CONTEXT HANDOFF v4 dưới đây, xác nhận đã nắm state, rồi tiếp tục viết TIP-004 — Entity Resolve + Alias Memory.

Quan trọng:
- User xưng “tôi/bác”, assistant xưng “em”.
- Ngôn ngữ: tiếng Việt.
- Không code trực tiếp vào project; chỉ viết TIP cho Codex/Builder.
- Những gì Codex test được thì đưa cho Codex test; user chỉ test tay phần Codex không test được.
- TIP-001, TIP-002, TIP-003 đã APPROVED.
- TIP-003 live AI test đã PASS sau khi fix structured output schema.
- Next là TIP-004, không hỏi lại những gì đã có trong handoff.

[PASTE TOÀN BỘ CONTEXT HANDOFF v4]
```

---

## 14. Current official status

```text
Project: Sổ Thông Minh
Phase: Phase 1 — Step 5 TASK GRAPH
Current TIP: TIP-004 next
Done:
  TIP-001 APPROVED
  TIP-002 APPROVED
  TIP-003 APPROVED + live AI PASS

Next action:
  Contractor writes TIP-004 Entity Resolve + Alias Memory.
```

---

*End of Context Handoff v4.*
