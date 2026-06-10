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
  customer_id: "cust-1",
  customer_name: "anh Hùng",
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
  let historyOrderBuilder: MaybeSingleBuilder;
  let historyItemsBuilder: OrderBuilder;
  let historyCustomerBuilder: MaybeSingleBuilder;

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
    historyOrderBuilder = makeMaybeSingleBuilder({
      data: {
        customer_id: "cust-1",
        business_date: "2026-06-02",
        total_amount: "300000",
        debt_amount: "300000",
      },
      error: null,
    });
    historyItemsBuilder = makeOrderBuilder({
      data: [
        {
          product_name_snapshot: "xi măng",
          unit_snapshot: "bao",
          quantity: "3",
          unit_price: "100000",
          line_total: "300000",
        },
      ],
      error: null,
    });
    historyCustomerBuilder = makeMaybeSingleBuilder({
      data: { name: "anh Hùng" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    let orderReadCount = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        orderReadCount += 1;
        return orderReadCount === 1 ? dateBuilder : historyOrderBuilder;
      }

      if (table === "order_items") {
        return historyItemsBuilder;
      }

      if (table === "customers") {
        return historyCustomerBuilder;
      }

      return { insert: mocks.insert };
    });
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
    expect(mocks.insert).toHaveBeenNthCalledWith(1, {
      owner_id: "user-a",
      event_type: "order_created",
    });
    expect(mocks.from).toHaveBeenNthCalledWith(3, "orders");
    expect(historyOrderBuilder.select).toHaveBeenCalledWith(
      "customer_id,business_date,total_amount,debt_amount",
    );
    expect(historyOrderBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyOrderBuilder.eq).toHaveBeenNthCalledWith(2, "id", "order-1");
    expect(historyOrderBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(4, "order_items");
    expect(historyItemsBuilder.select).toHaveBeenCalledWith(
      "product_name_snapshot,unit_snapshot,quantity,unit_price,line_total,sort_order",
    );
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(2, "order_id", "order-1");
    expect(historyItemsBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(historyItemsBuilder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(mocks.from).toHaveBeenNthCalledWith(5, "customers");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(2, "id", "cust-1");
    expect(historyCustomerBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(6, "chat_messages");
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi đơn cho anh Hùng",
      intent: "create_order",
      metadata: {
        order_id: "order-1",
        card: {
          v: 1,
          kind: "create_order",
          entity_name: "anh Hùng",
          business_date: "2026-06-02",
          total_amount: 300000,
          debt_amount: 300000,
          amount: null,
          items: [
            {
              name: "xi măng",
              quantity: 3,
              unit: "bao",
              unit_price: 100000,
              line_total: 300000,
            },
          ],
          source_id: "order-1",
        },
        source: "tip_18b",
      },
    });
  });

  it("keeps assistant text metadata when history card snapshot build fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    historyOrderBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "RLS denied" },
    });

    const result = await commitOrder(validInput);

    expect(result.ok).toBe(true);
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi đơn cho anh Hùng",
      intent: "create_order",
      metadata: {
        order_id: "order-1",
        source: "tip_18b",
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to build history commit card snapshot",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
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
    expect(mocks.from).not.toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      event_type: "order_created",
    });
  });

  it("keeps the committed response ok when assistant persistence fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.insert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: "42501", message: "RLS denied" } });

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
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist assistant terminal chat message",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
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
