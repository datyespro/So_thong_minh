import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: unknown };

const state = {
  user: { id: "owner-1" } as { id: string } | null,
  paymentBefore: { data: null, error: null } as Result,
  category: { data: null, error: null } as Result,
  paymentUpdate: { data: null, error: null } as Result,
  chatSelect: { data: null, error: null } as Result,
  auditError: null as unknown,
  fromTables: [] as string[],
  eqCalls: [] as [string, unknown][],
  paymentUpdatePayloads: [] as Record<string, unknown>[],
  chatUpdatePayloads: [] as Record<string, unknown>[],
  insertPayloads: [] as Record<string, unknown>[],
};

function makeBuilder(table: string) {
  state.fromTables.push(table);
  let isUpdate = false;

  const builder: Record<string, unknown> = {
    select: () => builder,
    is: () => builder,
    eq: (col: string, val: unknown) => {
      state.eqCalls.push([col, val]);
      return builder;
    },
    update: (payload: Record<string, unknown>) => {
      isUpdate = true;
      if (table === "payments") state.paymentUpdatePayloads.push(payload);
      else if (table === "chat_messages") state.chatUpdatePayloads.push(payload);
      return builder;
    },
    insert: (payload: Record<string, unknown>) => {
      state.insertPayloads.push(payload);
      return Promise.resolve({ error: state.auditError });
    },
    maybeSingle: async () => {
      if (table === "payments") {
        return isUpdate ? state.paymentUpdate : state.paymentBefore;
      }
      if (table === "product_categories") return state.category;
      if (table === "chat_messages") return state.chatSelect;
      return { data: null, error: null };
    },
    // chat_messages UPDATE được await trực tiếp (không maybeSingle).
    then: (resolve: (value: Result) => unknown) =>
      resolve({ data: null, error: null }),
  };

  return builder;
}

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: state.user },
        error: null,
      })),
    },
    from: vi.fn((table: string) => makeBuilder(table)),
  })),
}));

const { updatePaymentScope } = await import("@/app/(app)/chat/actions");

describe("updatePaymentScope (DC-4b)", () => {
  beforeEach(() => {
    state.user = { id: "owner-1" };
    state.paymentBefore = {
      data: { id: "pay-1", scope_category_id: "cat-old", scope_product_id: null },
      error: null,
    };
    state.category = { data: { id: "cat-xm", name: "Xi măng" }, error: null };
    state.paymentUpdate = {
      data: { id: "pay-1", scope_category_id: "cat-xm" },
      error: null,
    };
    state.chatSelect = {
      data: {
        metadata: {
          source: "tip_18b",
          card: { v: 1, kind: "record_payment", source_id: "pay-1", scope_label: "Cũ" },
        },
      },
      error: null,
    };
    state.auditError = null;
    state.fromTables = [];
    state.eqCalls = [];
    state.paymentUpdatePayloads = [];
    state.chatUpdatePayloads = [];
    state.insertPayloads = [];
  });

  it("đổi nhóm thành công: UPDATE chỉ scope_category_id, audit, metadata, trả scope_label", async () => {
    const res = await updatePaymentScope("pay-1", "cat-xm", "msg-1");

    expect(res).toEqual({ ok: true, data: { scope_label: "Xi măng" } });

    // UPDATE payments CHỈ đụng cột scope_category_id (KHÔNG amount/debt_total).
    expect(state.paymentUpdatePayloads).toEqual([{ scope_category_id: "cat-xm" }]);

    // KHÔNG gọi customers / RPC nợ.
    expect(state.fromTables).not.toContain("customers");
    expect(state.fromTables).toContain("payments");

    // Owner-scoped ở cả đọc lẫn ghi.
    expect(state.eqCalls).toContainEqual(["owner_id", "owner-1"]);
    expect(state.eqCalls).toContainEqual(["id", "pay-1"]);

    // audit_log before/after đúng.
    expect(state.insertPayloads).toHaveLength(1);
    const audit = state.insertPayloads[0];
    expect(audit.entity_type).toBe("payment");
    expect(audit.action).toBe("payment/scope_update");
    expect(audit.before_data).toEqual({ scope_category_id: "cat-old" });
    expect(audit.after_data).toEqual({ scope_category_id: "cat-xm" });

    // metadata.card.scope_label cập nhật = "Xi măng", giữ source + card khác.
    expect(state.chatUpdatePayloads).toHaveLength(1);
    const meta = state.chatUpdatePayloads[0].metadata as Record<string, unknown>;
    expect(meta.source).toBe("tip_18b");
    expect((meta.card as Record<string, unknown>).scope_label).toBe("Xi măng");
    expect((meta.card as Record<string, unknown>).source_id).toBe("pay-1");
  });

  it("bỏ nhóm (null): UPDATE scope_category_id=null, trả scope_label null, KHÔNG validate danh mục", async () => {
    state.paymentUpdate = {
      data: { id: "pay-1", scope_category_id: null },
      error: null,
    };

    const res = await updatePaymentScope("pay-1", null, "msg-1");

    expect(res).toEqual({ ok: true, data: { scope_label: null } });
    expect(state.paymentUpdatePayloads).toEqual([{ scope_category_id: null }]);
    // Bỏ nhóm → KHÔNG truy vấn product_categories.
    expect(state.fromTables).not.toContain("product_categories");
    // metadata.card.scope_label = null.
    const meta = state.chatUpdatePayloads[0].metadata as Record<string, unknown>;
    expect((meta.card as Record<string, unknown>).scope_label).toBeNull();
  });

  it("nhóm không hợp lệ (đã xóa mềm/khác owner) → validation_failed, KHÔNG UPDATE", async () => {
    state.category = { data: null, error: null };

    const res = await updatePaymentScope("pay-1", "cat-deleted");

    expect(res).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Nhóm không hợp lệ ạ.",
    });
    expect(state.paymentUpdatePayloads).toHaveLength(0);
    expect(state.insertPayloads).toHaveLength(0);
  });

  it("khoản gắn theo sản phẩm → chặn trước khi UPDATE", async () => {
    state.paymentBefore = {
      data: { id: "pay-1", scope_category_id: null, scope_product_id: "prod-9" },
      error: null,
    };

    const res = await updatePaymentScope("pay-1", "cat-xm");

    expect(res).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Khoản này đang gắn theo sản phẩm, chưa đổi nhóm được ạ.",
    });
    expect(state.paymentUpdatePayloads).toHaveLength(0);
    expect(state.fromTables).not.toContain("product_categories");
  });

  it("owner khác / không tìm thấy payment → validation_failed", async () => {
    state.paymentBefore = { data: null, error: null };

    const res = await updatePaymentScope("pay-x", "cat-xm");

    expect(res).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khoản thu để đổi nhóm.",
    });
    expect(state.paymentUpdatePayloads).toHaveLength(0);
  });

  it("paymentId rỗng → validation_failed, KHÔNG chạm DB", async () => {
    const res = await updatePaymentScope("  ", "cat-xm");

    expect(res.ok).toBe(false);
    expect(state.fromTables).toHaveLength(0);
  });

  it("lỗi audit là best-effort → vẫn ok:true (đổi nhãn đã xong)", async () => {
    state.auditError = { message: "audit boom" };

    const res = await updatePaymentScope("pay-1", "cat-xm", "msg-1");

    expect(res.ok).toBe(true);
    // Đã UPDATE thật rồi mới tới audit.
    expect(state.paymentUpdatePayloads).toEqual([{ scope_category_id: "cat-xm" }]);
  });
});
