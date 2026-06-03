import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  orderSelect: vi.fn(),
  orderEq: vi.fn(),
  orderMaybeSingle: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

const { recreateSaleOrder } = await import("@/app/(app)/chat/actions");

const validInput = {
  oldOrderId: "order-old",
  idempotencyKey: "idem-new",
  customer_id: "cust-1",
  raw_input: "anh Hung mua 12 bao xi mang",
  items: [
    {
      product_id: "prod-1",
      product_name_snapshot: "xi mang",
      unit_snapshot: "bao",
      quantity: 12,
      unit_price: 90000,
    },
  ],
};

describe("recreateSaleOrder", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.orderSelect.mockReset();
    mocks.orderEq.mockReset();
    mocks.orderMaybeSingle.mockReset();

    const orderBuilder = {
      select: mocks.orderSelect,
      eq: mocks.orderEq,
      maybeSingle: mocks.orderMaybeSingle,
    };

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue(orderBuilder);
    mocks.orderSelect.mockReturnValue(orderBuilder);
    mocks.orderEq.mockReturnValue(orderBuilder);
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { business_date: "2026-05-20", status: "confirmed" },
      error: null,
    });
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_undone: false }, error: null })
      .mockResolvedValueOnce({
        data: {
          order_id: "order-new",
          total_amount: 1080000,
          debt_amount: 1080000,
        },
        error: null,
      });
  });

  it("reads the original order with owner filter, then undoes before recommitting on the original date", async () => {
    const result = await recreateSaleOrder(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        newOrderId: "order-new",
        total_amount: 1080000,
        debt_amount: 1080000,
        business_date: "2026-05-20",
      },
    });

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("orders");
    expect(mocks.orderSelect).toHaveBeenCalledWith("business_date,status");
    expect(mocks.orderEq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(mocks.orderEq).toHaveBeenNthCalledWith(2, "id", "order-old");

    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      "undo_order",
      "commit_sale_order",
    ]);
    expect(mocks.rpc.mock.calls[0][1]).toEqual({ p_order_id: "order-old" });

    const commitParams = mocks.rpc.mock.calls[1][1];
    expect(commitParams.p_idempotency_key).toBe("idem-new");
    expect(commitParams.p_customer_id).toBe("cust-1");
    expect(commitParams.p_business_date).toBe("2026-05-20");
    expect(commitParams.p_note).toBe("anh Hung mua 12 bao xi mang");
    expect(commitParams.p_items).toEqual(validInput.items);
  });

  it("returns not_editable for a non-confirmed original order without undoing", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { business_date: "2026-05-20", status: "voided" },
      error: null,
    });

    const result = await recreateSaleOrder(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_editable");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns not_found when the original order is missing or belongs to another owner", async () => {
    mocks.orderMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await recreateSaleOrder(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns already_undone and does not recommit when undo reports an already voided order", async () => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValueOnce({
      data: { already_undone: true },
      error: null,
    });

    const result = await recreateSaleOrder(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("already_undone");
    }
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("undo_order", {
      p_order_id: "order-old",
    });
  });

  it("returns recommit_failed with oldVoided when the new commit fails after undo", async () => {
    mocks.rpc.mockReset();
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_undone: false }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await recreateSaleOrder(validInput);

    expect(result).toEqual({
      ok: false,
      code: "recommit_failed",
      message: "Đơn cũ đã huỷ, ghi lại không thành công. Bác tạo lại đơn giúp em ạ.",
      oldVoided: true,
    });
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      "undo_order",
      "commit_sale_order",
    ]);
  });
});
