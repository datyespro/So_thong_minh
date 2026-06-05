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

const { commitPurchase } = await import("@/app/(app)/chat/actions");

const validInput = {
  idempotency_key: "idem-1",
  supplier_id: null,
  raw_input: "nhập 100 bao xi măng 80k",
  items: [
    {
      product_id: "prod-1",
      product_name_snapshot: "xi măng",
      unit_snapshot: "bao",
      quantity: 100,
      unit_cost: 80000,
    },
  ],
};

describe("commitPurchase", () => {
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
        purchase_id: "purchase-1",
        total_amount: 8000000,
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
      table === "purchases" ? dateBuilder : { insert: mocks.insert },
    );
  });

  it("commits a supplierless purchase and logs purchase_created telemetry", async () => {
    const result = await commitPurchase(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        purchase_id: "purchase-1",
        total_amount: 8000000,
        business_date: "2026-06-02",
      },
    });

    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_purchase");
    expect(params.p_supplier_id).toBeNull();
    expect(params.p_business_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.p_items).toEqual([
      {
        product_id: "prod-1",
        product_name_snapshot: "xi măng",
        unit_snapshot: "bao",
        quantity: 100,
        unit_cost: 80000,
      },
    ]);

    expect(mocks.from).toHaveBeenNthCalledWith(1, "purchases");
    expect(mocks.dateSelect).toHaveBeenCalledWith("business_date");
    expect(mocks.dateEq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(mocks.dateEq).toHaveBeenNthCalledWith(2, "id", "purchase-1");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "usage_events");
    expect(mocks.insert).toHaveBeenNthCalledWith(1, {
      owner_id: "user-a",
      event_type: "purchase_created",
    });
    expect(mocks.from).toHaveBeenNthCalledWith(3, "chat_messages");
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi nhập hàng",
      intent: "create_purchase",
      metadata: {
        purchase_id: "purchase-1",
        source: "tip_18b",
      },
    });
  });

  it("passes a supplier id through when present", async () => {
    await commitPurchase({
      ...validInput,
      supplier_id: "supplier-9",
      supplier_name: "NCC A",
    });

    const [, params] = mocks.rpc.mock.calls[0];
    expect(params.p_supplier_id).toBe("supplier-9");
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi nhập hàng từ NCC A",
      intent: "create_purchase",
      metadata: {
        purchase_id: "purchase-1",
        source: "tip_18b",
      },
    });
  });

  it("does not persist assistant text when the rpc reuses an existing purchase", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        purchase_id: "purchase-1",
        total_amount: 8000000,
        idempotent_reuse: true,
      },
      error: null,
    });

    const result = await commitPurchase(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        purchase_id: "purchase-1",
        total_amount: 8000000,
        business_date: "2026-06-02",
      },
    });
    expect(mocks.from).not.toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty purchase without calling the rpc", async () => {
    const result = await commitPurchase({ ...validInput, items: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an item with a negative unit cost", async () => {
    const result = await commitPurchase({
      ...validInput,
      items: [{ ...validInput.items[0], unit_cost: -1 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects when not authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await commitPurchase(validInput);

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a database failure to db_error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await commitPurchase(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("db_error");
    }
  });
});
