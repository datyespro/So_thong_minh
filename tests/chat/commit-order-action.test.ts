import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  dateSelect: vi.fn(),
  dateEq: vi.fn(),
  dateMaybeSingle: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

const { commitOrder } = await import("@/app/(app)/chat/actions");

const validInput = {
  idempotency_key: "idem-1",
  customer_id: "cust-1",
  raw_input: "anh Hùng mua 3 bao xi măng",
  items: [
    {
      product_id: "prod-1",
      product_name_snapshot: "xi măng",
      unit_snapshot: "bao",
      quantity: 3,
      unit_price: 100000,
    },
  ],
};

describe("commitOrder", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.dateSelect.mockReset();
    mocks.dateEq.mockReset();
    mocks.dateMaybeSingle.mockReset();

    const dateBuilder = {
      select: mocks.dateSelect,
      eq: mocks.dateEq,
      maybeSingle: mocks.dateMaybeSingle,
    };

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "order-1",
        total_amount: 300000,
        debt_amount: 300000,
        idempotent_reuse: false,
      },
      error: null,
    });
    mocks.dateSelect.mockReturnValue(dateBuilder);
    mocks.dateEq.mockReturnValue(dateBuilder);
    mocks.dateMaybeSingle.mockResolvedValue({
      data: { business_date: "2026-06-02" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) =>
      table === "orders" ? dateBuilder : { insert: mocks.insert },
    );
  });

  it("commits via the rpc and logs telemetry without content", async () => {
    const result = await commitOrder(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        order_id: "order-1",
        total_amount: 300000,
        debt_amount: 300000,
        business_date: "2026-06-02",
      },
    });

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_sale_order");
    expect(params.p_idempotency_key).toBe("idem-1");
    expect(params.p_customer_id).toBe("cust-1");
    expect(params.p_note).toBe("anh Hùng mua 3 bao xi măng");
    // business_date is computed server-side in Asia/Ho_Chi_Minh, never CURRENT_DATE.
    expect(params.p_business_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.p_items).toEqual([
      {
        product_id: "prod-1",
        product_name_snapshot: "xi măng",
        unit_snapshot: "bao",
        quantity: 3,
        unit_price: 100000,
      },
    ]);

    // telemetry: owner + event only, no customer/product/amount.
    expect(mocks.from).toHaveBeenNthCalledWith(1, "orders");
    expect(mocks.dateSelect).toHaveBeenCalledWith("business_date");
    expect(mocks.dateEq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(mocks.dateEq).toHaveBeenNthCalledWith(2, "id", "order-1");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "usage_events");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      event_type: "order_created",
    });
  });

  it("returns ok when the rpc reuses an existing order (idempotent)", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        order_id: "order-1",
        total_amount: 300000,
        debt_amount: 300000,
        idempotent_reuse: true,
      },
      error: null,
    });

    const result = await commitOrder(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        order_id: "order-1",
        total_amount: 300000,
        debt_amount: 300000,
        business_date: "2026-06-02",
      },
    });
  });

  it("rejects when not authenticated and never calls the rpc", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await commitOrder(validInput);

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty order without calling the rpc", async () => {
    const result = await commitOrder({ ...validInput, items: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an item with a non-positive quantity", async () => {
    const result = await commitOrder({
      ...validInput,
      items: [{ ...validInput.items[0], quantity: 0 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a database failure to a friendly db_error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await commitOrder(validInput);

    expect(result).toEqual({
      ok: false,
      code: "db_error",
      message: "Chưa ghi được đơn, bác thử lại ạ.",
    });
  });
});
