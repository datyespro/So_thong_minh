# 📋 CONTEXT HANDOFF v6 — Sổ Thông Minh

> **Mục đích:** Paste tài liệu này vào đầu session mới để ChatGPT/Claude tiếp tục công việc ở vai **Chủ thầu (Contractor)** mà không mất context.
>
> **Cập nhật:** 29/05/2026 — sau khi TIP-005b.1, TIP-006a, TIP-006b, TIP-SEED, TIP-003-FIX đã APPROVED. **TIP-006c vừa DONE, đang chờ Chủ nhà test tay** (chưa APPROVE).
>
> **Thay thế:** CONTEXT_HANDOFF_v5.md. Giữ v5 làm reference cũ nếu cần.

---

## 0. Meta — Vai trò & Workflow

* **Methodology:** Vibecode Kit v6.0 / workflow Chủ nhà → Chủ thầu → Builder.
* **Vai trò:**
  * User = **Chủ nhà (Homeowner)** — ra quyết định chiến lược, test những phần Builder không test được.
  * ChatGPT/Claude Chat = **Chủ thầu (Contractor)** — design, RRI, orchestrate, viết TIP, review report, KHÔNG code trực tiếp.
  * Codex/Claude Code = **Builder/Thợ thi công** — implement TIPs, chạy test, báo cáo.
* **Xưng hô:** User xưng "tôi/bác", assistant xưng "em".
* **Ngôn ngữ:** Tiếng Việt.
* **Current Step:** **Phase 1 — Step 5/6 TASK GRAPH / BUILD**
  * TIP-001 → TIP-005b ✅ APPROVED (xem v5 cho chi tiết)
  * TIP-005b.1 ✅ APPROVED (sample prompt notes)
  * TIP-006a ✅ APPROVED (nối pipeline + "Đang đọc...")
  * TIP-006b ✅ APPROVED (Preview Card + vá-tại-chỗ + lịch sử kiểu C)
  * TIP-SEED ✅ APPROVED (bơm data mẫu local)
  * TIP-003-FIX ✅ APPROVED (dạy Stage 1 phân biệt bán/nhập)
  * **TIP-006c 🟡 DONE — ĐANG CHỜ CHỦ NHÀ TEST TAY** (Entity Confirm Modal + tạo khách + mở ô giá sửa-luôn)
  * **Next sau 006c:** TIP-007 — Ghi đơn thật (commit transaction + công nợ + Undo)
* **Quy tắc làm việc:**
  * Viết từng TIP một, không batch nhiều TIP.
  * Mỗi TIP phải có: Goal, Scope, Inputs, Outputs, Implementation Steps, Acceptance Criteria dạng Gherkin, QA prompt cho Builder, report format.
  * Sau khi Builder làm xong, Builder phải test tối đa phần tự động được. User chỉ test tay phần Builder không test được.
  * Không chuyển TIP tiếp nếu TIP hiện tại có blocker hoặc chưa APPROVE.
  * **Nếu thiếu context để viết TIP chính xác → viết một probe TIP (read-only) cho Builder chạy lấy thông tin thật, đừng đoán.** (Pattern này đã dùng thành công ở TIP-004-PROBE, TIP-006-PROBE, TIP-006c-PROBE.)
  * **Tách TIP lớn thành phần nhỏ** khi nó gộp nhiều thứ (logic + UI + ghi DB). Đã tách thành công: 005a/005b, và 006a/006b/006c.

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

**Logic:** 1 design partner dùng sâu > 5 partner dùng nông. Builder solo. Mẹ bỏ được sổ giấy là proof of concept quan trọng nhất.

**Action:** Tập trung 100% vào mẹ trong 6 tuần MVP. Báo mentor sớm: ưu tiên depth thay vì breadth. Mở rộng từ Week 7+ / Phase 7.

Không đề xuất lại multi-shop trong MVP (đã chốt defer sang post-MVP).

---

## 3. Tooling & Environments

User có 3 Supabase environment:

1. **Supabase local** — build/test chính. Mọi TIP database test bằng local trước. Dùng `supabase db reset`, Docker Postgres, tests SQL.
2. **Supabase dev cloud** — tên dự kiến `sotm-dev`. Dùng sau khi local pass. MCP có thể connect.
3. **Supabase production cloud** — tên dự kiến `sotm-prod`. Tuyệt đối không test TIP, không connect MCP. Chỉ đụng ở deploy/release.

### Tooling đã chốt: Phương án A — Supabase CLI + Supabase MCP

| Tool | Vai trò |
| ---- | ------- |
| Supabase CLI | Local dev, migration files, `db reset`, schema versioning |
| Supabase MCP | AI-assisted schema/query trên local/dev cloud |

**Quy tắc bảo mật MCP:** Chỉ kết nối local + `sotm-dev`. Không bao giờ connect `sotm-prod`. Mọi schema change phải có file `.sql` trong `supabase/migrations/`. MCP chỉ apply/query, không tạo schema "tàng hình".

### ⚠️ Env quirks đã gặp (KHÔNG phải bug code)

* **Kong 502 sau `supabase db reset`:** sau reset, Kong đôi khi giữ upstream Auth cũ → `/auth/v1` trả 502. Fix: `docker restart supabase_kong_Sotm_project`. **Đừng tưởng nhầm là lỗi code.**
* **pnpm vắng PATH ở một số shell của Builder:** Builder dùng `npm.cmd` + local binaries. **Phải đảm bảo KHÔNG sinh `package-lock.json` lẫn cạnh `pnpm-lock.yaml`.** Tới TIP-006c chưa thấy lockfile lạ — tiếp tục canh.
* **Dev server hay kẹt / không tự chạy sau QA của Builder:** Shell của Builder **tự dọn tiến trình nền** sau khi lệnh kết thúc → sau khi Builder QA xong, **KHÔNG có server nào đang listen**. Chủ nhà phải tự bật server để test tay: mở Terminal → `npm.cmd run dev` → đợi "ready" → mở địa chỉ nó in ra. **Cổng có thể là 3000 hoặc 3010 tùy cổng trống** (đã thấy chạy ở cả hai). Nếu gặp màn "Chưa lưu được tin" hoặc overlay runtime kẹt → tắt terminal, xóa cache `.next`, chạy lại. Đây là runtime cũ kẹt, KHÔNG phải bug.
* **"git status: dirty" trong report Builder:** có khi do shell không trả exit code của `git status`, KHÔNG phải file bị sửa. Với probe read-only, kiểm bằng file/grep listing là đủ.

### ⚠️ Workspace CHƯA có `.git` (rủi ro vận hành — CẦN QUYẾT)

* Dự án **không có version control**. Builder xác nhận "workspace không có `.git`" ở nhiều report.
* Hệ quả: nếu một TIP sau làm hỏng, **không có nút lùi** — phải sửa tay hoặc dựng lại.
* **Chủ thầu đã đề xuất `git init` + commit mốc mỗi TIP APPROVED. Chủ nhà CHƯA quyết.** → Session mới nên nhắc lại đề xuất này (việc ~5 phút, không đụng logic), đặc biệt trước khi vào TIP-007 (ghi DB thật, rủi ro cao hơn).

---

## 4. Requirements Matrix — Important MVP Requirements

Giữ 32 REQ cũ từ v2/v3 + 3 REQ Phase 0.

### 3 REQ Phase 0

| REQ-ID | Requirement | Priority | Persona |
| ------ | ----------- | -------- | ------- |
| REQ-B11 | Multi-tenant isolation từ đầu, giữ owner_id + RLS dù MVP chỉ có mẹ | P0 | Operator |
| REQ-D06 | Usage telemetry: log `{owner_id, event_type, timestamp}` cho login/ghi đơn/tra cứu/sửa đơn, không lưu content | P0 | Operator |
| REQ-S04 | Mẹ ngừng dùng sổ giấy ở Week 6, verify bằng ảnh sổ + interview thực địa | P0 | Success |

### Defer sang Phase 7 / post-MVP

REQ-U06 multi-shop user · REQ-B10 onboarding self-service <15 phút · REQ-F09 owner self-service settings · REQ-S03 2-3 shop active Week 6 · REQ-S05 weekly interview cycle multi-shop

---

## 5. Database Schema Current State

TIP-002 đã hoàn tất + duyệt. **14 bảng:**

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

### Chi tiết quan trọng (xác nhận qua TIP-004-PROBE + TIP-006c-PROBE)

**customers** (insert tối thiểu = `name` + `owner_id`, mọi cột khác có default):
```sql
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  debt_total NUMERIC(14,0) NOT NULL DEFAULT 0,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customers_name_not_blank CHECK (length(btrim(name)) > 0)
);
```

**customers / products / suppliers** — cả 3 bảng đã có:
* `owner_id UUID NOT NULL` + RLS enabled + policy lọc `auth.uid() = owner_id` (SELECT/UPDATE/DELETE; INSERT dùng WITH CHECK).
* `aliases TEXT[] NOT NULL DEFAULT '{}'::text[]` + **GIN index** trên aliases (cả 3 bảng).
* `is_active BOOLEAN`, `deleted_at` (soft delete).
* Unique index `(owner_id, lower(name)) WHERE is_active AND deleted_at IS NULL` → tên active không trùng trong cùng owner.
* **Cột tên là `name`** (KHÔNG phải `full_name`).
* `customers.debt_total`, `products.current_stock` (denormalized, sync bằng trigger).
* `products.sell_price` và `products.cost_price` đều **nullable**.

**pending_previews** (dùng ở Stage 4 — TIP-007 sẽ ghi, TIP-006 KHÔNG ghi):
```sql
CREATE TABLE public.pending_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preview_type TEXT NOT NULL,           -- 'order'|'payment'|'purchase'|'edit_order'|'query'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'confirmed'|'cancelled'|'expired'
  payload JSONB NOT NULL,
  idempotency_key TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**chat_messages:** `owner_id, role, content, intent, metadata, created_at`.

**Trigram index:** `customers.name` và `products.name` có `gin_trgm_ops`. `suppliers.name` CHƯA có trgm (chỉ btree + aliases GIN).

**Extensions:** `pg_trgm` ENABLED (1.6). `unaccent` và `fuzzystrmatch` **NOT ENABLED** (chốt giữ vậy cho MVP).

**Helper functions TIP-002:** `set_updated_at`, `prevent_update_delete_immutable`, `sync_customer_debt_total`, `sync_product_current_stock`, `expire_pending_previews`, các `assert_*_same_owner`. **KHÔNG có** helper SQL nào cho normalize/search/match → resolver làm bằng TypeScript.

**Views:** `v_customer_balances`, `v_inventory_status`, `v_daily_sales`, `v_usage_daily` — tất cả `security_invoker = true`.

### Quy tắc tạo TIP database
Migration file trong local repo → test Supabase local → pass mới apply dev cloud → KHÔNG đụng production.

---

## 6. TIP Status

| TIP | Tên | Status |
| --- | --- | ------ |
| TIP-001 | Scaffold + Auth | ✅ APPROVED |
| TIP-002 | Database Schema | ✅ APPROVED |
| TIP-003 | AI Pipeline Foundation + Stage 1 Extract Intent | ✅ APPROVED + live PASS |
| TIP-004 | Entity Resolve + Alias Memory | ✅ APPROVED + live PASS |
| TIP-005a | Stage 3 Validate | ✅ APPROVED |
| TIP-005b | Chat UI Scaffold | ✅ APPROVED |
| TIP-005b.1 | Khôi phục Sample Prompt Notes | ✅ APPROVED |
| TIP-006-PROBE | Dump context Stage 4 | ✅ DONE (read-only) |
| TIP-006a | Nối pipeline thật + "Đang đọc..." | ✅ APPROVED |
| TIP-006b | Preview Card + vá-tại-chỗ + lịch sử kiểu C | ✅ APPROVED |
| TIP-SEED | Bơm data mẫu (customers/products/suppliers) local | ✅ APPROVED |
| TIP-003-FIX | Dạy Stage 1 phân biệt bán/nhập | ✅ APPROVED + live PASS |
| TIP-006c-PROBE | Dump context tạo khách + alias | ✅ DONE (read-only) |
| **TIP-006c** | **Entity Confirm Modal + tạo khách + mở ô giá sửa-luôn** | **🟡 DONE — CHỜ CHỦ NHÀ TEST TAY** |
| TIP-007 | Stage 5 Ghi đơn thật + công nợ + Undo | ⏳ (sau 006c) |
| TIP-008 | Query Features F04/F06/F07 | ⏳ |
| TIP-009 | Edit Order + Diff View + Compensating Ledger | ⏳ |
| TIP-010 | Telemetry Dashboard + Verify Job + QA + Deploy | ⏳ |

> **Lưu ý đánh số:** TIP-006 được tách làm **006a (nối pipeline) + 006b (Preview Card) + 006c (Confirm Modal)** để tách logic khỏi UI cần test tay. 006c xong = TIP-006 đóng trọn vẹn. SEED + 003-FIX là 2 TIP xen ngang phát sinh từ test tay, không chiếm số TIP chính.

---

## 7. Pipeline tổng thể & tiến độ

```text
User text → Stage 1 Extract Intent → Stage 2 Entity Resolve → Stage 3 Validate → Stage 4 Preview + Confirm → Stage 5 Commit transaction
```

```text
Stage 1 Extract  ✅ (TIP-003, +003-FIX)
Stage 2 Resolve  ✅ (TIP-004)
Stage 3 Validate ✅ (TIP-005a)
Stage 4 Preview  🟡 (TIP-006a/b/c — 006c chờ test tay)
Stage 5 Commit   ⏳ (TIP-007 next)
```

**Hàm orchestrator chạy liền 3 stage:** `src/lib/ai/chat-pipeline.ts` → `runChatPipeline` (tạo ở 006a). Trả `{ok:true, validated} | {ok:false, stage, code, message}`. Issue nghiệp vụ (blocking) KHÔNG phải lỗi ống → vẫn `ok:true`. Chỉ `extract` được import openai/ai; resolve/validate/pipeline deterministic.

---

## 8. TIP-005b.1 Summary (APPROVED)

**Goal:** Khôi phục 4 "tờ note" mẫu ở empty state màn chat. Bấm note → điền câu mẫu vào ô gõ + focus, **KHÔNG tự gửi**. Note ẩn khi đã có lịch sử.

**4 note mặc định:** GHI ĐƠN ("anh Hùng mua 20 bao xi măng 1,6 triệu") · THU NỢ ("anh Tuấn trả nợ 500k") · HỎI ("anh Hùng còn nợ bao nhiêu?") · BÁO CÁO ("doanh thu hôm nay").

**Files:** `src/components/chat/sample-prompt-notes.tsx`, sửa `chat-container.tsx` (`handlePickSample` + ref textarea), `message-list.tsx`, `message-input.tsx` (forwardRef).

**QA:** lint/typecheck/build PASS, 83 tests PASS. Test tay PASS (bấm chỉ điền, không gửi; ẩn khi có lịch sử; Enter bàn phím cũng được).

---

## 9. TIP-006a Summary (APPROVED)

**Goal:** Thay dòng assistant tĩnh bằng kết quả pipeline THẬT. Mẹ gửi câu → chạy extract → resolve → validate ở server → trả `ValidatedIntent` → hiển thị THÔ. Hiện "Đang đọc..." trong lúc chạy.

**Files:** `src/lib/ai/chat-pipeline.ts` (orchestrator mới), `app/(app)/chat/actions.ts` (thêm `processMessage`, giữ nguyên `sendMessage`), `chat-container.tsx` (bỏ ASSISTANT_PLACEHOLDER), `message-list.tsx`, `typing-indicator.tsx` ("Đang đọc..."), `pipeline-result-debug.tsx` (UI thô tạm — đã bị 006b xoá).

**Contract:**
* `processMessage(content)` → `{ok:true, userMessage, pipeline} | {ok:false, code, message}`.
* `pipeline = {ok:true, validated} | {ok:false, stage, code, message}`.
* Tái dùng `sendMessage` để lưu user row (KHÔNG đổi contract sendMessage). KHÔNG service-role. KHÔNG ghi pending_previews. KHÔNG insert assistant row vào chat_messages.

**QA:** lint/typecheck/build PASS, **94 tests** PASS.

**Test tay (Chủ nhà) — PASS:**
* Đơn "anh Hùng mua 20 bao xi măng 1,6 triệu" → "Đang đọc..." rồi ra kết quả thô. (Lưu ý: lúc đầu gặp "Chưa lưu được tin", F5 hết → tạm thời do phiên/Kong/runtime kẹt, KHÔNG phải lỗi code.)
* "bán 20 bao xi măng" (thiếu khách) → vẫn ra kết quả, có blocking về thiếu khách (đúng).
* "chào buổi sáng" → small_talk, không vỡ.
* Sample note → vẫn chỉ điền, không gửi.

---

## 10. TIP-006b Summary (APPROVED)

**Goal:** Thay debug block bằng **Preview Card** (thẻ đơn) dễ đọc cho mẹ. Vá-tại-chỗ field tự-gõ-được khi thiếu. Lịch sử **kiểu C** (thẻ cũ đóng băng, chỉ thẻ mới nhất sống).

**Render theo `validated.kind`:**
* `writable` (create_order/record_payment/create_purchase) → thẻ đơn đầy đủ: tiêu đề tiếng Việt ("Đơn bán hàng"/"Đơn nhập hàng"/"Thu / trả nợ"), hàng Khách/Nhà cung cấp, bảng item (tên/SL/đơn giá/thành tiền), tổng tiền định dạng Việt ("2.000.000 đ"), khối blocking (đỏ) + warning (vàng) + info (xám), nút xác nhận.
* `query` → thẻ gọn "Câu hỏi: ..." + "trả lời ở bước sau" (TIP-008). Không nút.
* `none` (small_talk/unknown) → KHÔNG render thẻ, chỉ 1 dòng assistant ngắn.
* `edit`/`undo` → thẻ gọn "sẽ có ở bước sau".

**Nút xác nhận:** `ready_for_preview===false` HOẶC `blocking_count>0` → disabled. Chỉ warning → enabled. **Nút bấm = no-op/toast "sẽ có ở bước sau"** (chưa nối TIP-007).

**Vá-tại-chỗ (006b):** CHỈ field thiếu (đơn giá/số lượng/số tiền khi null). Parse số Việt ("100k"→100000, "1,6 triệu"→1600000). Sửa LOCAL state, gỡ issue tương ứng khỏi UI, recompute. KHÔNG gọi pipeline, KHÔNG ghi DB.

**Lịch sử kiểu C:** `chat-container.tsx` giữ danh sách "lượt pipeline". Chỉ thẻ mới nhất "sống" (có ô vá + nút). Thẻ cũ "đóng băng": mờ, bỏ ô vá + nút, tĩnh đọc-được.

**Files:** `src/components/chat/preview-card/` (component, types, parse/format tiền, patch-state), sửa `chat-container.tsx` + `message-list.tsx`, **xoá** `pipeline-result-debug.tsx`.

**QA:** lint/typecheck/build PASS, **107 tests** PASS.

**Test tay (Chủ nhà) — PASS:** thẻ đẹp, tổng tiền đúng định dạng Việt, ô vá giá chạy đúng, kiểu C đóng băng đúng, small_talk không ra thẻ, nút Ghi đơn chỉ toast. **Phát sinh yêu cầu mới:** cần cho sửa giá kể cả khi sổ ĐÃ có giá → chốt phương án A, gộp vào 006c.

---

## 11. TIP-SEED Summary (APPROVED)

**Goal:** Bơm data mẫu **CHỈ local** để có sân test resolve/preview/confirm. Idempotent. Guard chặn chạy nhầm cloud.

**Data đã bơm (owner = user test `dat@test.com`):**
* **customers:** anh Hùng (alias hùng/anh hung), anh Tuấn (tuấn), chị Lan (lan), anh Đạt (đạt).
* **products (có sell_price):** xi măng / bao / 100000 (alias "xi măng hoàng thạch", ximang, xi mang); cát / khối / 350000 (cát vàng, cat); gạch / viên / 1500 (gạch ống, gach); thép phi 6 / cây / 95000 (thép 6, sat phi 6).
* **suppliers:** Đại lý Minh Phát (minh phát, minh phat); Vật liệu Sông Hồng (sông hồng).
* KHÔNG seed orders/payments/purchases.

**QA + Test tay:** data đã vào đúng owner — xác nhận bằng cách gõ "anh Đạt mua 10 bao xi măng 100k" ở /chat → khách "anh Đạt" + hàng "xi măng" resolve XANH (không còn not_found). Owner đúng = bằng chứng RLS không giấu.

> **Lưu ý:** trang `/customers` và `/products` (sidebar) hiện **404 — chưa xây trang** (xem Sổ nợ #3). Kiểm seed phải qua `/chat` (resolve xanh) hoặc Supabase Studio Table Editor, KHÔNG qua sidebar.

---

## 12. TIP-003-FIX Summary (APPROVED)

**Goal:** Dạy Stage 1 phân biệt ỔN ĐỊNH "bán cho khách" (create_order) vs "nhập hàng" (create_purchase). **CHỈ sửa prompt, KHÔNG đụng schema.**

**Vấn đề đã sửa:** "anh Hùng mua 20 bao xi măng" từng bị phân loại create_purchase (sai) + không ổn định (lúc order lúc purchase).

**Quy tắc nghiệp vụ (Chủ nhà chốt):**
1. "mua/lấy" + chủ ngữ TÊN NGƯỜI → **create_order** (mình bán cho khách). Đây là mặc định cho cửa hàng bán lẻ vật liệu.
2. **create_purchase CHỈ khi có dấu hiệu nhập rõ:** "nhập" / "nhập hàng" / "nhập kho" / "lấy hàng TỪ + nhà cung cấp/đại lý/công ty" / có supplier kèm ngữ cảnh nguồn cung.
3. **Tie-break chữ "lấy":** "lấy" + tên khách + không có "từ nhà cung cấp" → create_order. "lấy hàng từ <NCC>" → create_purchase. Mơ hồ → ưu tiên create_order.
4. KHÔNG đụng intent khác (record_payment, query_*, small_talk).

**File:** CHỈ `src/lib/ai/prompts/extract-intent.ts` (thêm rule + 5 few-shot). **`intent-schema.ts` KHÔNG đổi — Builder chứng minh bằng hash giữ nguyên** (chống tái phát bug structured-output cũ: OpenAI strict response_format từ chối schema có default → đã tách `ExtractedIntentOutputSchema` (no default, gửi model) vs `ExtractedIntentSchema` (có default, app-side); TUYỆT ĐỐI không đụng cấu trúc 2-schema này).

**QA:** lint/typecheck/build PASS, 107 tests PASS, schema hash không đổi.

**Live test (Chủ nhà) — 6/6 PASS:**
* "anh Hùng mua 20 bao xi măng" → create_order ✅
* "chị Lan lấy 5 khối cát" → create_order ✅ (ra thẻ đẹp: cát 350000, tổng 1.750.000)
* "nhập 100 bao xi măng từ Minh Phát" → create_purchase ✅
* "lấy hàng từ Sông Hồng 200 viên gạch" → create_purchase ✅
* "anh Đạt mua 10 bao xi măng 100k" (x2-3 lần) → đều create_order ✅ (ổn định)
* "anh Tuấn trả nợ 500k" → record_payment ✅

---

## 13. TIP-006c Summary (🟡 DONE — ĐANG CHỜ TEST TAY)

**Goal:** Hoàn thiện thẻ để mẹ xử 3 việc NGAY TRONG CHAT: (A) sửa giá kể cả khi sổ đã có giá; (B) chọn đúng khách khi máy chưa chắc; (C) tạo khách mới khi chưa có. Sau chọn/tạo → học alias + cập nhật thẻ tại chỗ. **VẪN CHƯA ghi đơn thật (TIP-007).**

**Quyết định nghiệp vụ liên quan:**
* (A) ô giá sửa-luôn: **Chủ nhà chốt phương án A** — ô đơn giá (+ số lượng) trên thẻ SỐNG luôn bấm-sửa-được, kể cả khi đã có giá sổ. Sửa giá khi đang là giá sổ → **gỡ warning "dùng giá niêm yết"** (giờ là giá mẹ tự đặt). **KHÔNG làm multi-turn** (gõ câu "dùng giá 400k" để sửa đơn — Chủ nhà đã thử, máy không hiểu vì mỗi câu là việc độc lập; phương án B "dạy máy hiểu câu sửa" bị defer, có thể rất xa).
* (C) tạo khách: **Chủ nhà đồng ý tạo khách THẬT ngay khi bấm "Thêm"** (chỉ name + owner_id). Chấp nhận entity mồ côi nếu mẹ huỷ đơn (vô hại).
* **Tạo SẢN PHẨM mới: KHÔNG làm trong 006c** (sản phẩm cần giá/đơn vị → phức tạp hơn khách; defer sang TIP riêng). not_found sản phẩm chỉ báo "chưa có hàng", không nút tạo, nút Ghi đơn disabled.

**Files (theo report Builder):**
* `app/(app)/chat/actions.ts`: thêm `createCustomer(name)` — server client thường, auth.getUser, insert customers {owner_id, name}, KHÔNG service-role.
* `src/components/chat/preview-card/types.ts`: mở `PreviewCardPatch` giữ customer/supplier/product đã chọn/tạo.
* `src/components/chat/preview-card/preview-state.ts`: recompute card theo patch, gỡ blocking/warning đúng chỗ.
* `src/components/chat/preview-card/preview-card.tsx`: chọn/tạo khách, chọn sản phẩm, sửa giá/số lượng trên thẻ sống.
* `src/components/chat/preview-card/alias-client.ts`: gọi nền `/api/ai/confirm-alias`.

**Cơ chế đã build:**
* **Chọn khách** (status needs_confirmation/ambiguous): hiện candidates (tối đa 3, chỉ tên, KHÔNG score), mẹ bấm chọn → thẻ resolved tại chỗ + gọi `confirm-alias` nền (entity_type=customer, entity_id=candidate.id, alias=raw). Lỗi học alias KHÔNG chặn mẹ.
* **Tạo khách** (not_found hoặc chọn "thêm mới"): "Thêm «raw»?" → `createCustomer` → thẻ resolved. **Trùng tên xử mềm:** đọc khách active cùng owner trước; nếu race unique thì đọc lại trả khách có sẵn; cùng lắm báo "Khách này có rồi ạ."
* **Sửa giá/SL** (A): luôn sửa được trên thẻ sống, parse số Việt, gỡ warning autofill, recompute. LOCAL state, không pipeline, không DB.
* **Nút Ghi đơn:** vẫn no-op/toast (TIP-007).

**Reused (KHÔNG viết mới):** `confirmAlias({supabase, ownerId, entityType, entityId, alias})` + route `POST /api/ai/confirm-alias` (body {entity_type, entity_id, alias}). Route KHÔNG sửa, chỉ gọi.

**QA:** lint/typecheck/build PASS, **118 tests** PASS. Scope: không pending_previews/orders/payments/purchases insert, không service-role lạ, UI không import openai/ai, không migration/lockfile.

### ⚠️ TEST TAY ĐANG CHỜ CHỦ NHÀ (localhost — phải tự bật server: `npm.cmd run dev`)
1. **Sửa giá đã có:** "chị Lan lấy 5 khối cát" → ô giá 350000 bấm sửa "400k" → tổng 2.000.000, cảnh báo "dùng giá niêm yết" mất.
2. **Tạo khách mới:** "anh Phát mua 10 bao xi măng" (chưa có) → bấm "Thêm anh Phát" → khách rõ. **Kiểm Supabase Studio bảng customers có "anh Phát" thật** (chỗ ghi DB thật — quan trọng).
3. **Chọn khách + học alias:** gõ tên lệch để ra gợi ý → chọn → gõ lại tên đó xem máy có **nhớ** (alias) — quan trọng.
4. **Hàng chưa có:** "anh Hùng mua 5 bao đinh" → "chưa có hàng", không nút tạo, nút Ghi đơn mờ.
5. **Nút Ghi đơn:** đủ thông tin → bấm → chỉ toast, sổ chưa có đơn.

→ **Session mới: nếu chưa có kết quả test tay → chờ Chủ nhà báo, rồi APPROVE/NEEDS WORK. Nếu PASS → TIP-006 đóng, sang TIP-007.**

---

## 14. Quyết định nghiệp vụ đã chốt trong session này (tổng hợp)

| # | Quyết định | Ghi chú |
| - | ---------- | ------- |
| 1 | "tên người + mua/lấy" = create_order; chỉ create_purchase khi có "nhập/từ NCC/đại lý" | 003-FIX, live PASS |
| 2 | Tạo khách mới = chỉ name + owner_id, tạo THẬT ngay khi bấm "Thêm" | 006c |
| 3 | Tạo SẢN PHẨM mới: KHÔNG làm trong 006c (defer — cần giá/đơn vị) | 006c |
| 4 | Sửa giá: ô giá luôn sửa được trên thẻ sống (phương án A); KHÔNG làm multi-turn (B defer) | 006c |
| 5 | Lịch sử kiểu C: thẻ cũ đóng băng, chỉ thẻ mới nhất sống | 006b |
| 6 | "Đang đọc..." rồi bung thẻ một lượt; KHÔNG streamText cho ghi đơn | 006a |
| 7 | Blocking → khoá nút + vá-tại-chỗ (không bắt gõ lại câu); warning → cho qua | 006b/c |
| 8 | usage_events: HOÃN, chưa bật (vì giờ chỉ Chủ nhà test, số liệu rác) | Sổ nợ #2 |
| 9 | Trang Khách hàng/Sản phẩm 404: kệ tới khi xây trang thật | Sổ nợ #3 |

---

## 15. 📒 SỔ NỢ KỸ THUẬT (việc đã ghi nhận, xử sau)

| # | Nợ | Trạng thái | Khi nào xử |
| - | -- | ---------- | ---------- |
| #1 | Intent "mua" nhảy order/purchase | ✅ **ĐÓNG** (003-FIX, live PASS) | — |
| #2 | **Bật lại `usage_events`** (REQ-D06, P0) — telemetry đếm login/ghi đơn/tra cứu, KHÔNG lưu content | 🟡 MỞ | **NGAY TRƯỚC/ĐẦU TIP-007** — khi mẹ bắt đầu ghi đơn thật là lúc cần đếm, để Week-6 verify "mẹ có bỏ sổ giấy không". Bật trễ = Week 6 trống số liệu. **Chủ thầu PHẢI chủ động nhắc Chủ nhà mốc này.** |
| #3 | **Xây trang Khách hàng + Sản phẩm** (hiện 404) | 🟡 MỞ | Sau cụm TIP-006 + 007 (khi có data thật để hiển thị). Mẹ cần để xem khách nợ, sửa tên/giá sản phẩm. |
| #4 | **`git init`** + commit mốc mỗi TIP APPROVED (workspace chưa có version control) | 🟡 MỞ — Chủ nhà chưa quyết | Nên làm trước TIP-007 (ghi DB thật, rủi ro cao). Chủ thầu đã đề xuất, cần Chủ nhà gật. |
| #5 | Shape lỗi không nhất quán giữa các route AI (`extract-intent` trả `{ok:false,error:{code,message}}` lồng; `resolve/validate` trả phẳng `{ok:false,code,message}`) | 🟡 MỞ (cosmetic) | TIP polish sau. 006a gọi lib trực tiếp nên không bị ảnh hưởng. |

---

## 16. Next TIP — TIP-007 (sau khi 006c APPROVED)

**Tên:** Stage 5 Ghi đơn thật (Commit transaction) + Công nợ + Undo.

### Đây là bước "ghi vào sổ thật" đầu tiên
Nút "Ghi đơn" (hiện no-op) sẽ nối vào logic lưu đơn thật:
```text
Thẻ đủ thông tin → bấm "Ghi đơn" → ghi pending_previews (Stage 4 đúng vai) → commit transaction →
  tạo orders/order_items (hoặc payments / purchases tuỳ intent) →
  cập nhật công nợ (customers.debt_total) / tồn kho (products.current_stock) →
  hiển thị "Đã ghi đơn" + cho Undo
```

### Định hướng scope (Chủ thầu chốt chi tiết sau khi review code 006c)
* Nối nút Ghi đơn vào server action commit thật.
* **pending_previews:** đây là chỗ ĐẦU TIÊN ghi (TTL 1h) — đúng vai Stage 4.
* **Commit transaction:** dùng PL/pgSQL stored function (theo tên TIP-007 cũ "Stage 5 PL/pgSQL Stored Functions") để đảm bảo atomic: ghi đơn + cập nhật nợ/tồn trong 1 transaction.
* **Đọc lại giá/SL đã vá** từ state thẻ (006b/c giữ trong patched) khi commit.
* **Undo:** cho mẹ huỷ đơn vừa ghi (compensating, vì ledger immutable).
* **Bật usage_events** (Sổ nợ #2) — log event ghi đơn thật.
* Thẻ sau khi ghi → đóng băng thành "Đã ghi đơn cho <khách>" (ăn khớp lịch sử kiểu C).

### Câu hỏi nghiệp vụ cần hỏi Chủ nhà TRƯỚC khi viết TIP-007 (đề xuất default + cho veto, đừng đoán)
1. **Undo:** cho Undo trong bao lâu sau khi ghi (vd 1 phút / tới khi gửi tin mới / nút Undo luôn hiện trên thẻ vừa ghi)? Hay defer Undo sang TIP riêng và 007 chỉ ghi?
2. **record_payment quá số nợ (overpayment):** đã có warning ở validate. Khi ghi thật: cho ghi (nợ âm = trả dư) hay chặn?
3. **usage_events:** xác nhận bật từ 007 (đề xuất: CÓ — đúng Sổ nợ #2). Event types log gì (order_created, payment_recorded, purchase_created, undo...)?
4. **Probe trước 007?** Cần xem: orders/order_items/payments/purchases columns + đã có stored function commit nào chưa + cách wire patched-state từ thẻ. → **Nhiều khả năng cần TIP-007-PROBE read-only trước.**

→ **Session mới: sau khi 006c APPROVED, hỏi 4 câu này (hoặc đề xuất default cho Chủ nhà veto), cân nhắc probe, rồi mới viết TIP-007. Đừng đoán.**

---

## 17. User Testing Philosophy

> Những cái Builder test được thì đưa cho Builder test. Nếu Builder không test được thì Chủ nhà mới test. Nhất là mấy cái lệnh thì Builder test được.

Cho mỗi TIP:
* Dồn tất cả terminal/CLI/unit/db/build/lint vào Builder QA prompt.
* Chủ nhà chỉ test tay: visual UX, browser/auth session thật, **live AI output** (cần OpenAI key thật — Builder không có), product judgment, test với mẹ, **ghi DB thật** (kiểm qua Supabase Studio).

**Lý do test tay càng về sau càng nhiều:** UI thật + AI thật + "mẹ 54 tuổi có dùng được không" chỉ người thật trả lời được. Đây là lý do tách logic (Builder lo) khỏi UI/AI-sanity (Chủ nhà test).

**Builder không test được (phải Chủ nhà):**
* Bất kỳ thứ gì cần OpenAI key thật (phân loại intent, extract) → live test.
* Bất kỳ thứ gì cần browser + auth session thật (Builder bị policy chặn localhost, + shell tự dọn server).
* Ghi DB thật đúng owner (kiểm qua /chat resolve xanh hoặc Supabase Studio).

---

## 18. Suggested opening prompt cho session mới

Paste cái này trước, rồi paste toàn bộ handoff:

```text
Em là Chủ thầu (Contractor) trong dự án Sổ Thông Minh theo phương pháp Vibecode Kit v6.0.

Hãy đọc kỹ CONTEXT HANDOFF v6 dưới đây, xác nhận đã nắm state, rồi tiếp tục công việc.

Quan trọng:
- User xưng "tôi/bác", assistant xưng "em". Ngôn ngữ: tiếng Việt.
- Không code trực tiếp vào project; chỉ viết TIP cho Codex/Builder.
- Những gì Builder test được thì đưa cho Builder test; Chủ nhà chỉ test tay phần Builder không test được (live AI, browser thật, ghi DB thật).
- TIP-001 → TIP-006b + SEED + 003-FIX đã APPROVED. TIP-006c vừa DONE, đang chờ Chủ nhà test tay.
- Nếu thiếu context để viết TIP chính xác → viết probe TIP read-only cho Builder, đừng đoán.
- Đừng hỏi lại những gì đã có trong handoff.

Trạng thái hiện tại:
- Nếu TIP-006c chưa có kết quả test tay: chờ Chủ nhà báo kết quả 5 bước test (mục 13), review rồi APPROVE/NEEDS WORK.
- Nếu 006c đã APPROVED: hỏi 4 câu nghiệp vụ TIP-007 (mục 16) + cân nhắc TIP-007-PROBE, rồi viết TIP-007.
- Nhắc Chủ nhà 2 việc: (a) bật lại usage_events trước/đầu TIP-007 (Sổ nợ #2); (b) git init cho project (Sổ nợ #4, chưa quyết).

[PASTE TOÀN BỘ CONTEXT HANDOFF v6]
```

---

## 19. Current official status

```text
Project: Sổ Thông Minh
Phase: Phase 1 — Step 5/6 (TASK GRAPH / BUILD)

Done + APPROVED:
  TIP-001 → TIP-005b   (xem v5)
  TIP-005b.1  Sample Prompt Notes
  TIP-006a    Nối pipeline + "Đang đọc..."
  TIP-006b    Preview Card + vá-tại-chỗ + lịch sử kiểu C
  TIP-SEED    Bơm data mẫu local (owner dat@test.com)
  TIP-003-FIX Dạy Stage 1 phân biệt bán/nhập (live 6/6 PASS)

In progress:
  TIP-006c — Entity Confirm Modal + tạo khách + mở ô giá sửa-luôn
           → DONE, 118 tests PASS, CHỜ CHỦ NHÀ TEST TAY (5 bước, mục 13)

Next action:
  1. Nhận kết quả test tay 006c → APPROVE/NEEDS WORK.
  2. (006c APPROVED) → TIP-006 đóng trọn vẹn.
  3. Nhắc usage_events (Sổ nợ #2) + git init (Sổ nợ #4).
  4. Hỏi 4 câu nghiệp vụ TIP-007 + cân nhắc probe → viết TIP-007 (Ghi đơn thật + công nợ + Undo).

Pipeline build progress:
  Stage 1 Extract  ✅ (TIP-003 + 003-FIX)
  Stage 2 Resolve  ✅ (TIP-004)
  Stage 3 Validate ✅ (TIP-005a)
  Stage 4 Preview  🟡 (TIP-006a/b/c — 006c chờ test tay)
  Stage 5 Commit   ⏳ (TIP-007 next)

Số liệu tham chiếu:
  - Test suite hiện tại: 22 files / 118 tests PASS (sau 006c)
  - RESOLVE_THRESHOLDS thực tế: AUTO_RESOLVE_MIN=0.81, CONFIRM_MIN=0.40, AMBIGUITY_GAP=0.12
    (v5 ghi nhầm 0.72 — số đúng là 0.81, theo entity-resolver.ts)
  - User test: dat@test.com (data mẫu đã seed đúng owner này)

Known quirks (KHÔNG phải bug):
  - Kong 502 sau db reset → docker restart supabase_kong_Sotm_project
  - Dev server không tự chạy sau Builder QA → Chủ nhà tự `npm.cmd run dev`; cổng 3000 hoặc 3010
  - Runtime/overlay kẹt → xóa cache .next, chạy lại dev
  - pnpm vắng PATH → npm.cmd; canh chừng package-lock.json lạ (chưa thấy)
  - "git status: dirty" trong report = shell không trả exit code, không phải file bị sửa
  - Trang /customers, /products = 404 vì CHƯA XÂY (Sổ nợ #3), kiểm seed qua /chat hoặc Supabase Studio

Ranh giới quan trọng:
  - TIP-006 (a/b/c) TUYỆT ĐỐI chưa ghi orders/pending_previews. Nút Ghi đơn = no-op/toast.
  - Ghi đơn thật = TIP-007.
  - intent-schema.ts không được đụng (bug structured-output); 003-FIX chỉ sửa prompt.
  - Tạo sản phẩm mới chưa làm (defer); 006c chỉ tạo customer.
```

---

*End of Context Handoff v6.*