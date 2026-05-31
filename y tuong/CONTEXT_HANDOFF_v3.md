# 📋 CONTEXT HANDOFF v3 — Sổ Thông Minh

> **Mục đích:** paste tài liệu này vào đầu session mới để Claude tiếp tục công việc ở vai **Chủ thầu (Contractor)** mà không mất context.
> **Cập nhật:** 28/05/2026 — sau mentor feedback + Phase 0 decisions + TIP-001 hoàn tất.
> **Thay thế:** CONTEXT_HANDOFF_v2.md (vẫn nên giữ làm reference)

---

## 0. Meta — Vai trò & Workflow

- **Methodology:** Vibecode Kit v6.0 (skill `/vibecode-kit`)
- **Vai trò:**
  - User = **Chủ nhà (Homeowner)** — ra quyết định chiến lược
  - Claude Chat = **Chủ thầu (Contractor)** — design, RRI, orchestrate, KHÔNG code
  - Claude Code = **Thợ thi công (Builder)** — implement TIPs
- **Xưng hô:** User xưng "tôi/bác", Claude xưng "em"
- **Ngôn ngữ:** Tiếng Việt
- **Current Step:** **Phase 1 — Step 5 (TASK GRAPH) đang viết từng TIP một**
  - TIP-001 đã viết xong, đã update theo Phương án A (CLI + MCP)
  - Bác đang chuẩn bị setup thủ công (SETUP_GUIDE.md)
  - Chờ viết tiếp TIP-002 (Database Schema) — đã agree làm parallel khi bác setup
- **Next:** TIP-002 → TIP-010, mỗi TIP review chéo trước khi sang tiếp

---

## 1. Project Identity (không đổi)

**Tên:** Sổ Thông Minh

**Định vị 1 câu:** *Web app giúp chủ cửa hàng VLXD nhỏ bỏ sổ giấy — gõ một câu, AI ghi đơn, theo dõi công nợ, trả lời mọi câu hỏi về cửa hàng.*

**Design partner duy nhất ở MVP:** mẹ founder (54t, iPhone, gõ chậm, sổ giấy + Zalo)

**KPI chính:** Mẹ bỏ sổ giấy sau 1 tháng dùng (Week 6 verify).

---

## 2. ⚠️ Mentor Feedback (MỚI — quan trọng)

**Status:** PASSED, nhưng có **higher bar** ở Week 6:

> "But will need more users beyond your mom. Week-6 bar: real shops (beyond mom) still logging in + recording bills + asking questions daily at week 6. Mom has stopped going back to the paper ledger. At least one owner says 'if you took this away, I'd be unhappy'."

### Quyết định của bác sau cân nhắc 3 nhánh: **NHÁNH 1 — Mom-only, accept trượt gate**

**Logic:**
- 1 design partner dùng sâu > 5 partner dùng nông
- Builder solo, recruit + onboard rộng sẽ làm chậm build
- Mẹ bỏ được sổ giấy là proof of concept quan trọng nhất

**Action:**
- Tập trung 100% vào mẹ trong 6 tuần
- Báo mentor sớm (KHÔNG đợi Week 6): "Em ưu tiên depth thay vì breadth, sẽ recruit shop khác sau Week 6"
- Mở rộng từ Week 7+ (Phase 7, post-MVP)

---

## 3. State sau Phase 0

| Mục | Trạng thái |
|---|---|
| Step 1-2 (SCAN + RRI) | ✅ Done |
| Step 3 (VISION) | ✅ APPROVED |
| Step 4 (BLUEPRINT) | ✅ APPROVED toàn bộ |
| **Phase 0 (Adjust Plan sau mentor)** | ✅ **Done** |
| Step 5 (TASK GRAPH) | 🟡 **Đang làm — TIP-001 done, TIP-002 sắp viết** |
| Requirements Matrix | 33 items (32 cũ + 3 mới: REQ-B11, REQ-D06, REQ-S04) |
| Decisions Log | 33 cũ + chiến lược Nhánh 1 + Phương án A (CLI + MCP) |
| Schema | **14 bảng** (13 cũ + `usage_events` mới cho telemetry) |
| Tooling chốt | Supabase CLI (local) + Supabase MCP (AI-assisted) |

---

## 4. Requirements Matrix (33 items — cập nhật Phase 0)

### Giữ nguyên 32 REQ cũ từ v2 (xem CONTEXT_HANDOFF_v2.md §3)

### THÊM 3 REQ mới (Phase 0, Nhánh 1)

| REQ-ID | Requirement | Priority | Persona |
|---|---|---|---|
| **REQ-B11** | Multi-tenant isolation từ đầu (kiến trúc multi-tenant ready, giữ owner_id + RLS, không cắt dù MVP chỉ có mẹ) | P0 | Operator |
| **REQ-D06** | Usage telemetry: log `{owner_id, event_type, timestamp}` cho login/ghi đơn/tra cứu/sửa đơn — verify mẹ dùng daily, không lưu content | P0 | Operator |
| **REQ-S04** | Mẹ ngừng dùng sổ giấy ở Week 6 (verify bằng ảnh sổ + interview thực địa, KHÔNG tự khai) | P0 | Success |

### REQ chỉnh sửa từ v2

| REQ-ID | Thay đổi |
|---|---|
| REQ-S01 | Cộng thêm REQ-S04 vào điều kiện thành công |
| REQ-S02 | "1 design partner cực sâu" — giữ nguyên, không mở rộng partner ở MVP |

### REQ DEFER sang Phase 7 (post-MVP)

Đã từng đề xuất Phase 0 nhưng cắt theo Nhánh 1:
- REQ-U06 (multi-shop user)
- REQ-B10 (onboarding self-service <15')
- REQ-F09 (owner self-service settings)
- REQ-S03 (2-3 shop active Week 6)
- REQ-S05 (weekly interview cycle multi-shop)

---

## 5. Schema (14 bảng — cập nhật)

```
auth.users (Supabase managed)
├─ profiles                    (#1)
├─ customers                   (#2 — denorm debt_total + aliases TEXT[])
├─ products                    (#3 — denorm current_stock + aliases TEXT[])
├─ suppliers                   (#4)
├─ orders                      (#5 — business_date + idempotency_key UNIQUE)
├─ order_items                 (#6 — soft-delete)
├─ payments                    (#7)
├─ purchases                   (#8)
├─ purchase_items              (#9)
├─ inventory_movements         (#10 — IMMUTABLE)
├─ audit_log                   (#11 — IMMUTABLE)
├─ chat_messages               (#12)
├─ pending_previews            (#13 — TTL 1h)
└─ usage_events                (#14 — MỚI từ Phase 0, REQ-D06)
```

### Bảng MỚI: `usage_events`

```sql
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login', 'order_created', 'order_edited',
    'payment_created', 'query', 'undo'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_events_owner_time ON usage_events(owner_id, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read" ON usage_events FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "owner_insert" ON usage_events FOR INSERT WITH CHECK (owner_id = auth.uid());
-- KHÔNG có UPDATE/DELETE — append-only telemetry
```

**Không lưu content** — chỉ event_type + timestamp.

---

## 6. Khung 7 Phase — Cập nhật theo Nhánh 1

```
Phase 0 — Adjust Plan                   ✅ DONE
   ├── Requirements Matrix v2 (thêm 3 REQ)
   ├── Schema +1 bảng usage_events
   ├── Defer Recruit Profile sang Phase 7
   └── PMF Measurement Framework (3 trục)

Phase 1 — Step 5 Task Graph              🟡 ĐANG LÀM
   ├── TIP-001 ✅ done (đã update Phương án A)
   ├── TIP-002 → TIP-010 (sắp viết, từng cái)
   └── Output: 10 TIPs đầy đủ

Phase 2 — Build (Step 6)                 (~3 tuần Claude Code)
Phase 3 — Soft Launch + Iterate với mẹ   (Week 1-4 sau deploy)
Phase 4 — Verify (Step 7) + Polish       (Week 5)
Phase 5 — Week 6 PMF Gate                (Sean Ellis test mẹ)
Phase 6 — Mentor Report + Decision
Phase 7 — Expand (post-MVP, Week 7+)     ← Pull Recruit Profile đã lưu
```

---

## 7. Tooling chốt (Phase 0)

**Phương án A: CLI + MCP** (đã chốt sau cân nhắc 3 phương án)

| Tool | Vai trò |
|---|---|
| Supabase CLI | Local dev (Docker) + migration files Git versioning + `db reset` clean state |
| Supabase MCP | Builder bảo Claude Code "show schema", "apply migration", "query bảng X" qua chat |

**Quy tắc bảo mật MCP:**
- ✅ Chỉ kết nối local + `sotm-dev` (cloud dev project)
- ❌ KHÔNG bao giờ kết nối `sotm-prod`
- ✅ Mọi schema change phải có file `.sql` trong `supabase/migrations/` (MCP chỉ apply, không tạo schema "tàng hình")

**Lý do chọn cả hai:** MCP đẩy nhanh tốc độ Builder, CLI giữ kỷ luật migration + offline dev + clean reset.

---

## 8. PMF Measurement Framework (đo mẹ, Week 1-6)

### 3 trục đo

**A. Quantitative (telemetry từ `usage_events`):**

| Metric | Mục tiêu Week 6 |
|---|---|
| Daily active | Mẹ login ≥5/7 ngày tuần cuối |
| Daily ghi đơn | ≥3 ngày/tuần có event_type='order_created' |
| Daily tra cứu | ≥2 ngày/tuần có event_type='query' |
| Coverage | ≥80% đơn thật của mẹ vào app |

**B. Behavioral (verify thực địa):**

| Tuần | Việc |
|---|---|
| Week 2 | Bác ghé thăm — chụp ảnh sổ giấy, đếm trang |
| Week 4 | Ghé lại — đếm trang mới (kỳ vọng giảm) |
| Week 6 | Ghé lại — sổ giấy "đóng băng" = thắng |

**C. Qualitative (interview hàng tuần, 15'):**

4 câu cố định:
1. "Tuần này mẹ dùng app mấy ngày? Hôm nào không dùng vì sao?"
2. "Có chỗ nào tuần này mẹ vẫn ghi sổ giấy thay vì app không?"
3. "Có lúc nào mẹ bực app và muốn bỏ không?"
4. Câu mở: "Tuần này có gì khác tuần trước?"

**Week 6 Sean Ellis test:**
> "Mẹ ơi, nếu mai con tắt app này, không cho mẹ dùng nữa, mẹ thấy thế nào?"
> A. Rất buồn / không chịu nổi (= PMF)
> B. Hơi khó chịu nhưng quen lại sổ giấy được
> C. Không sao cả

---

## 9. Decisions Log (cập nhật)

### Từ v2 (33 quyết định) — giữ nguyên

Xem CONTEXT_HANDOFF_v2.md §4.

### Quyết định MỚI Phase 0

| # | Quyết định | Lý do |
|---|---|---|
| **34** | **Nhánh 1 — Mom-only, accept trượt gate mentor Week 6** | Depth > breadth; recruit shop khác từ Phase 7 |
| **35** | **Phương án A: Supabase CLI + Supabase MCP** | CLI giữ kỷ luật migration + offline; MCP đẩy nhanh schema work qua chat |
| **36** | **Tạo 2 Supabase project: `sotm-dev` + `sotm-prod`** | MCP bypass RLS qua service_role, không bao giờ connect production |
| **37** | **Thêm bảng `usage_events` (#14)** cho telemetry REQ-D06 | Cần bằng chứng định lượng "mẹ dùng daily" trước mentor Week 6 |
| **38** | **Mọi schema change phải có migration file** dù dùng MCP | Tránh schema drift, giữ Git versioning |
| **39** | **Recruit Profile + Pipeline Template lưu lại** chứ không xóa | Pull ra dùng ở Phase 7 (post-MVP expand) |

---

## 10. Status TIP-001 (chi tiết)

**File:** `/mnt/user-data/outputs/tips/TIP-001-scaffold-auth.md`
**Effort:** 4-6h Builder time (0.5-1 ngày)
**Status:** ✅ Bác đã duyệt OK (với 3 điểm em flag), em đã update Phương án A.

### Nội dung TIP-001

- **Goal:** Scaffold Next.js 15 + Supabase + Tailwind + shadcn/ui. Login email+password. Protected route shell.
- **Outputs:** package.json, 2 migration files (extensions + profiles), 3 Supabase clients (browser/server/admin), login page, AuthGuard, sidebar shell placeholder, ActionResult type.
- **REQ coverage:** REQ-T01, REQ-U05, REQ-U03, partial REQ-D01.
- **AC:** 11 Gherkin scenarios (project scaffold, migrations, auth login/logout, route protection, UI rendering, MCP integration).
- **Risks:** R-T1 (Next.js 15 breaking), R-T2 (shadcn React 19), R-T3 (email confirm default), R-T4 (MCP bypass RLS), R-T5 (schema drift MCP vs migration).
- **Constraints quan trọng:**
  - KHÔNG signup form (user tạo manual)
  - KHÔNG dùng `@supabase/auth-helpers-nextjs` (deprecated)
  - Mọi schema change qua migration file (kể cả MCP)
  - KHÔNG kết nối MCP với production

### File phụ trợ

**SETUP_GUIDE.md** đã viết xong (`/mnt/user-data/outputs/SETUP_GUIDE.md`) cho bác làm thủ công TRƯỚC khi giao Builder. Có 7 mục: cloud accounts, máy local, MCP config, credentials, decisions, checklist 14-item, cách giao TIP cho Builder.

---

## 11. Status các TIP còn lại (preview, chưa viết chi tiết)

| TIP | Tên | Effort | Status |
|---|---|---|---|
| 001 | Scaffold + Auth | 0.5-1d | ✅ DONE |
| 002 | Database Schema (14 bảng + RLS + indexes + views + bảng usage_events MỚI) | 1.5-2d | 🟡 NEXT |
| 003 | AI Pipeline Foundation + Stage 1 (Extract Intent) | 1-1.5d | ⏳ |
| 004 | Stage 2 Entity Resolve + Alias Memory | 1d | ⏳ |
| 005 | Stage 3 Validate + Chat UI Scaffold | 1-1.5d | ⏳ |
| 006 | Stage 4 Streaming + Preview Card + Entity Confirm Modal | 1.5-2d | ⏳ |
| 007 | Stage 5 PL/pgSQL Stored Functions + Server Actions + Undo | 2-2.5d | ⏳ |
| 008 | Query Features (F04, F06, F07) | 1-1.5d | ⏳ |
| 009 | Edit Order (F05) + Diff View + Compensating Ledger | 1.5d | ⏳ |
| 010 | Telemetry Dashboard + Verify Job + QA + Deploy | 1.5-2d | ⏳ THÊM telemetry (REQ-D06) + cross-tenant test (REQ-B11) |

**Tổng:** 13-17 ngày Builder time. Có thể parallel TIP-008 + TIP-009 sau TIP-007.

---

## 12. Workflow viết TIP (đã chốt với bác)

Mỗi TIP em làm 3 bước:

1. **Viết TIP đầy đủ** ra file `/mnt/user-data/outputs/tips/TIP-XXX-name.md`
2. **Self-review** trước khi giao bác — check 4 thứ:
   - DoD có testable không (Gherkin AC cụ thể)?
   - Inputs đầy đủ (Builder không phải đoán)?
   - REQ coverage đúng?
   - Cross-check với TIP trước (dependencies có khớp)?
3. **Present file** → bác duyệt "OK" hoặc "sửa X" → mới sang TIP tiếp

**Lý do làm từng cái:** Batch 10 TIP khó kiểm soát chất lượng. Mỗi TIP file 200-400 dòng, fix 1 cái rẻ hơn fix cả 10.

---

## 13. Cách dùng tài liệu này ở session mới

**Paste prompt sau vào đầu chat mới:**

> Em là Chủ thầu (Contractor) trong dự án Sổ Thông Minh theo phương pháp Vibecode Kit v6.0. Step 4 (BLUEPRINT) đã APPROVED, Phase 0 đã done, đang ở giữa Step 5 (TASK GRAPH) — đã viết xong TIP-001, sắp viết TIP-002. Dưới đây là context handoff v3 đầy đủ.
>
> Hãy đọc kỹ, xác nhận đã nắm state, rồi tiếp tục viết TIP-002 (Database Schema).
>
> [paste toàn bộ nội dung file này]
>
> /vibecode-kit

**Lưu ý quan trọng cho Claude session mới:**
- Load skill `/vibecode-kit` ngay
- Bác xưng "tôi/bác", Claude xưng "em"
- Mọi câu factual về OpenAI/Supabase/Next.js/Vercel AI SDK/MCP — **search web** vì versions có thể đổi
- **Mentor feedback đã được phản hồi bằng Nhánh 1 — KHÔNG đề xuất multi-shop lại trong MVP**
- **Phương án A (CLI + MCP) đã chốt** — không đề xuất chuyển sang B/C
- Mỗi TIP viết XONG TIP-001 rồi mới sang TIP-002, KHÔNG batch
- Tham chiếu chi tiết Blueprint/AI Pipeline/wireframes ở `BLUEPRINT.md` (file đã upload trước)

---

## 14. Deliverables hiện có

| File | Path | Mục đích |
|---|---|---|
| One-pager Proposal | `/mnt/user-data/outputs/one-pager-so-thong-minh.md` | Báo cáo mentor (đã PASSED) |
| Context Handoff v2 | `/mnt/user-data/outputs/CONTEXT_HANDOFF_v2.md` | Reference cũ (giữ lại) |
| **Context Handoff v3** | `/mnt/user-data/outputs/CONTEXT_HANDOFF_v3.md` | **Session bridge mới (file này)** |
| BLUEPRINT.md | `/mnt/user-data/outputs/BLUEPRINT.md` | Tài liệu Step 4 đầy đủ (architecture, AI Pipeline, wireframes) |
| **SETUP_GUIDE.md** | `/mnt/user-data/outputs/SETUP_GUIDE.md` | **Bác làm thủ công trước khi giao Builder** |
| **TIP-001-scaffold-auth.md** | `/mnt/user-data/outputs/tips/TIP-001-scaffold-auth.md` | **TIP đầu tiên, đã update Phương án A** |

---

## 15. Quyết định tiếp theo của bác

Sau khi sang session mới, em có 4 nhánh tiếp theo (mặc định Nhánh A):

**Nhánh A — Viết TIP-002 ngay** (default, parallel với bác setup)
TIP nặng nhất: 14 bảng + RLS + indexes + views + 6 stored functions. Em produce file đầy đủ → bác review.

**Nhánh B — Đợi bác setup xong rồi mới viết TIP-002**
Bác làm SETUP_GUIDE trước, báo "setup xong", em mới viết TIP-002.

**Nhánh C — Bác phát hiện sai sót TIP-001 cần fix**
Bác chỉ ra chỗ sai, em fix TIP-001 trước khi sang TIP-002.

**Nhánh D — Bác có câu hỏi/clarify về Phase 0 decisions**
Em giải thích, có thể revise quyết định nào đó trước khi đi tiếp.

---

## 16. Snapshot context bác đã đồng ý

Để session mới không phải hỏi lại:

✅ **Mentor feedback:** chọn Nhánh 1 (mom-only)
✅ **Tooling:** Phương án A (CLI + MCP)
✅ **Workflow:** viết từng TIP, review chéo, không batch
✅ **TIP-001:** đã duyệt OK
✅ **SETUP_GUIDE:** đã giao bác làm thủ công
✅ **TIP-002:** đồng ý em viết parallel khi bác setup

**Đang chờ:**
- Bác setup theo SETUP_GUIDE (45-60 phút)
- Em viết TIP-002 (1-2 giờ session time)

---

*End of Context Handoff v3. Ready cho session mới tiếp tục từ TIP-002.*
