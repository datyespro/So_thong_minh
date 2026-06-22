import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
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
  let historyOrderBuilder: MaybeSingleBuilder;
  let historyItemsBuilder: OrderBuilder;
  let historyCustomerBuilder: MaybeSingleBuilder;

  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.orderSelect.mockReset();
    mocks.orderEq.mockReset();
    mocks.orderMaybeSingle.mockReset();

    const orderBuilder = {
      select: mocks.orderSelect,
      eq: mocks.orderEq,
      is: vi.fn(() => orderBuilder),
      maybeSingle: mocks.orderMaybeSingle,
    };

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    historyOrderBuilder = makeMaybeSingleBuilder({
      data: {
        customer_id: "cust-1",
        business_date: "2026-05-20",
        total_amount: "1080000",
        debt_amount: "1080000",
      },
      error: null,
    });
    historyItemsBuilder = makeOrderBuilder({
      data: [
        {
          product_name_snapshot: "xi mang",
          unit_snapshot: "bao",
          quantity: "12",
          unit_price: "90000",
          line_total: "1080000",
        },
      ],
      error: null,
    });
    historyCustomerBuilder = makeMaybeSingleBuilder({
      data: { name: "anh Hung" },
      error: null,
    });
    let orderReadCount = 0;
    mocks.from.mockImplementation((table: string) => {
      if (table === "orders") {
        orderReadCount += 1;
        return orderReadCount === 1 ? orderBuilder : historyOrderBuilder;
      }

      if (table === "order_items") {
        return historyItemsBuilder;
      }

      if (table === "customers") {
        return historyCustomerBuilder;
      }

      return { insert: mocks.insert };
    });
    mocks.orderSelect.mockReturnValue(orderBuilder);
    mocks.orderEq.mockReturnValue(orderBuilder);
    mocks.orderMaybeSingle.mockResolvedValue({
      data: { business_date: "2026-05-20", status: "confirmed" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
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

    expect(mocks.from).toHaveBeenCalledTimes(5);
    expect(mocks.from).toHaveBeenNthCalledWith(1, "orders");
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

    expect(mocks.from).toHaveBeenNthCalledWith(2, "orders");
    expect(historyOrderBuilder.select).toHaveBeenCalledWith(
      "customer_id,business_date,total_amount,debt_amount",
    );
    expect(historyOrderBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyOrderBuilder.eq).toHaveBeenNthCalledWith(2, "id", "order-new");
    expect(historyOrderBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(3, "order_items");
    expect(historyItemsBuilder.select).toHaveBeenCalledWith(
      "product_name_snapshot,unit_snapshot,quantity,unit_price,line_total,sort_order",
    );
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyItemsBuilder.eq).toHaveBeenNthCalledWith(2, "order_id", "order-new");
    expect(historyItemsBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(historyItemsBuilder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    });
    expect(mocks.from).toHaveBeenNthCalledWith(4, "customers");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(2, "id", "cust-1");
    expect(historyCustomerBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(5, "chat_messages");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      role: "assistant",
      content: "Đã sửa đơn",
      intent: "edit_order",
      metadata: {
        old_order_id: "order-old",
        new_order_id: "order-new",
        card: {
          v: 1,
          kind: "edit_order",
          entity_name: "anh Hung",
          business_date: "2026-05-20",
          total_amount: 1080000,
          debt_amount: 1080000,
          amount: null,
          items: [
            {
              name: "xi mang",
              quantity: 12,
              unit: "bao",
              unit_price: 90000,
              line_total: 1080000,
            },
          ],
          source_id: "order-new",
          scope_label: null,
        },
        source: "tip_18b",
      },
    });
  });

  it("does not persist assistant text when the recommit reuses an existing order", async () => {
    mocks.rpc.mockReset();
    mocks.rpc
      .mockResolvedValueOnce({ data: { already_undone: false }, error: null })
      .mockResolvedValueOnce({
        data: {
          order_id: "order-new",
          total_amount: 1080000,
          debt_amount: 1080000,
          idempotent_reuse: true,
        },
        error: null,
      });

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
    expect(mocks.from).not.toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).not.toHaveBeenCalled();
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
