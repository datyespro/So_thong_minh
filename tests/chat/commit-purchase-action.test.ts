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

type MockFn = ReturnType<typeof vi.fn>;
type MaybeSingleBuilder = {
  select: MockFn;
  eq: MockFn;
  is: MockFn;
  maybeSingle: MockFn;
};
type OrderBuilder = {
  select: MockFn;
  eq: MockFn;
  is: MockFn;
  order: MockFn;
};

function makeMaybeSingleBuilder(result: unknown): MaybeSingleBuilder {
  const builder = {} as MaybeSingleBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

function makeOrderBuilder(result: unknown): OrderBuilder {
  const builder = {} as OrderBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.order = vi.fn(async () => result);
  return builder;
}

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
  let historyPurchaseBuilder: MaybeSingleBuilder;
  let historyItemsBuilder: OrderBuilder;
  let historySupplierBuilder: MaybeSingleBuilder;

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
      is: vi.fn(() => dateBuilder),
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
    historyPurchaseBuilder = makeMaybeSingleBuilder({
      data: {
        supplier_id: null,
        business_date: "2026-06-02",
        total_amount: "8000000",
      },
      error: null,
    });
    historyItemsBuilder = makeOrderBuilder({
      data: [
        {
          product_name_snapshot: "xi măng",
          unit_snapshot: "bao",
          quantity: "100",
          unit_cost: "80000",
          line_total: "8000000",
        },
      ],
      error: null,
    });
    historySupplierBuilder = makeMaybeSingleBuilder({
      data: { name: "NCC A" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    let purchaseReadCount = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "purchases") {
        purchaseReadCount += 1;
        return purchaseReadCount === 1 ? dateBuilder : historyPurchaseBuilder;
      }

      if (table === "purchase_items") {
        return historyItemsBuilder;
      }

      if (table === "suppliers") {
        return historySupplierBuilder;
      }

      return { insert: mocks.insert };
    });
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
    expect(mocks.from).toHaveBeenNthCalledWith(3, "purchases");
    expect(historyPurchaseBuilder.select).toHaveBeenCalledWith(
      "supplier_id,business_date,total_amount",
    );
    expect(historyPurchaseBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyPurchaseBuilder.eq).toHaveBeenNthCalledWith(2, "id", "purchase-1");
    expect(historyPurchaseBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(4, "purchase_items");
    expect(historyItemsBuilder.select).toHaveBeenCalledWith(
      "product_name_snapshot,unit_snapshot,quantity,unit_cost,line_total,sort_order",
    );
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "purchase_id",
      "purchase-1",
    );
    expect(historyItemsBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(historyItemsBuilder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(mocks.from).toHaveBeenNthCalledWith(5, "chat_messages");
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi nhập hàng",
      intent: "create_purchase",
      metadata: {
        purchase_id: "purchase-1",
        card: {
          v: 1,
          kind: "create_purchase",
          entity_name: null,
          business_date: "2026-06-02",
          total_amount: 8000000,
          debt_amount: null,
          amount: null,
          items: [
            {
              name: "xi măng",
              quantity: 100,
              unit: "bao",
              unit_price: 80000,
              line_total: 8000000,
            },
          ],
          source_id: "purchase-1",
        },
        source: "tip_18b",
      },
    });
  });

  it("passes a supplier id through when present", async () => {
    historyPurchaseBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        supplier_id: "supplier-9",
        business_date: "2026-06-02",
        total_amount: "8000000",
      },
      error: null,
    });

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
        card: {
          v: 1,
          kind: "create_purchase",
          entity_name: "NCC A",
          business_date: "2026-06-02",
          total_amount: 8000000,
          debt_amount: null,
          amount: null,
          items: [
            {
              name: "xi măng",
              quantity: 100,
              unit: "bao",
              unit_price: 80000,
              line_total: 8000000,
            },
          ],
          source_id: "purchase-1",
        },
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

  it("passes a valid requested business date to the purchase RPC", async () => {
    await commitPurchase({ ...validInput, business_date: "2026-06-01" });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "commit_purchase",
      expect.objectContaining({ p_business_date: "2026-06-01" }),
    );
  });

  it("rejects invalid and future business dates before calling the RPC", async () => {
    const invalid = await commitPurchase({
      ...validInput,
      business_date: "2026-02-31",
    });
    const future = await commitPurchase({
      ...validInput,
      business_date: "9999-12-31",
    });

    expect(invalid).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Ngày ghi sổ không hợp lệ ạ.",
    });
    expect(future).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Ngày ghi sổ không được ở tương lai ạ.",
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
