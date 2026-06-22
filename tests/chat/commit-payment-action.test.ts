import { beforeEach, describe, expect, it, vi } from "vitest";
import { businessDateVN } from "@/src/lib/dayjs";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  updateAiInteractionOutcome: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

vi.mock("@/src/lib/ai/interaction-log", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/interaction-log")>();

  return {
    ...actual,
    updateAiInteractionOutcome: mocks.updateAiInteractionOutcome,
  };
});

const { commitPayment } = await import("@/app/(app)/chat/actions");

type MockFn = ReturnType<typeof vi.fn>;
type MaybeSingleBuilder = {
  select: MockFn;
  eq: MockFn;
  is: MockFn;
  maybeSingle: MockFn;
};

function makeMaybeSingleBuilder(result: unknown): MaybeSingleBuilder {
  const builder = {} as MaybeSingleBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

const validInput = {
  idempotency_key: "idem-1",
  customer_id: "cust-1",
  customer_name: "anh Tuấn",
  amount: 200000,
  raw_input: "anh Tuấn trả 200k",
};

describe("commitPayment", () => {
  let historyPaymentBuilder: MaybeSingleBuilder;
  let historyCustomerBuilder: MaybeSingleBuilder;
  let historyCategoryBuilder: MaybeSingleBuilder;

  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.updateAiInteractionOutcome.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        business_date: "2025-10-11",
        idempotent_reuse: false,
      },
      error: null,
    });
    mocks.updateAiInteractionOutcome.mockResolvedValue(undefined);
    historyPaymentBuilder = makeMaybeSingleBuilder({
      data: {
        customer_id: "cust-1",
        amount: "200000",
        scope_category_id: null,
      },
      error: null,
    });
    historyCustomerBuilder = makeMaybeSingleBuilder({
      data: { name: "anh Tuấn" },
      error: null,
    });
    historyCategoryBuilder = makeMaybeSingleBuilder({
      data: { name: "Xi măng" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "payments") {
        return historyPaymentBuilder;
      }

      if (table === "customers") {
        return historyCustomerBuilder;
      }

      if (table === "product_categories") {
        return historyCategoryBuilder;
      }

      return { insert: mocks.insert };
    });
  });

  it("records the payment and logs payment_created telemetry", async () => {
    const result = await commitPayment(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        business_date: "2025-10-11",
      },
    });

    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_payment");
    expect(params.p_idempotency_key).toBe("idem-1");
    expect(params.p_customer_id).toBe("cust-1");
    expect(params.p_amount).toBe(200000);
    expect(params.p_method).toBeNull();

    expect(mocks.from).toHaveBeenNthCalledWith(1, "usage_events");
    expect(mocks.insert).toHaveBeenNthCalledWith(1, {
      owner_id: "user-a",
      event_type: "payment_created",
    });
    expect(mocks.from).toHaveBeenNthCalledWith(2, "payments");
    expect(historyPaymentBuilder.select).toHaveBeenCalledWith(
      "customer_id,amount,scope_category_id",
    );
    expect(historyPaymentBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyPaymentBuilder.eq).toHaveBeenNthCalledWith(2, "id", "payment-1");
    expect(historyPaymentBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(3, "customers");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyCustomerBuilder.eq).toHaveBeenNthCalledWith(2, "id", "cust-1");
    expect(historyCustomerBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.from).toHaveBeenNthCalledWith(4, "chat_messages");
    expect(mocks.insert).toHaveBeenNthCalledWith(2, {
      owner_id: "user-a",
      role: "assistant",
      content: "Đã ghi thu nợ cho anh Tuấn",
      intent: "record_payment",
      metadata: {
        payment_id: "payment-1",
        card: {
          v: 1,
          kind: "record_payment",
          entity_name: "anh Tuấn",
          business_date: null,
          total_amount: null,
          debt_amount: null,
          amount: 200000,
          items: null,
          source_id: "payment-1",
          scope_label: null,
        },
        source: "tip_18b",
      },
    });
  });

  it("marks the AI interaction committed when ai_turn_id is present", async () => {
    const result = await commitPayment({
      ...validInput,
      ai_turn_id: "turn-payment",
    });

    expect(result.ok).toBe(true);
    expect(mocks.updateAiInteractionOutcome).toHaveBeenCalledWith({
      supabase: expect.objectContaining({ from: mocks.from }),
      ownerId: "user-a",
      aiTurnId: "turn-payment",
      outcome: "committed",
    });
  });

  it("does not persist assistant text when the rpc reuses an existing payment", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        business_date: "2025-10-11",
        idempotent_reuse: true,
      },
      error: null,
    });

    const result = await commitPayment({
      ...validInput,
      ai_turn_id: "turn-payment-reuse",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        business_date: "2025-10-11",
      },
    });
    expect(mocks.from).not.toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.updateAiInteractionOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        aiTurnId: "turn-payment-reuse",
        outcome: "committed",
      }),
    );
  });

  it("maps any rpc error to a generic db_error (no special 'exceeds' handling — VĐ3)", async () => {
    // VĐ3: trả vượt nợ được phép, RPC v3 không còn RAISE 'exceeds'. Kể cả lỗi chứa
    // "exceeds" cũng map về db_error chung — không còn nhánh validation_failed riêng.
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "payment 999000 exceeds current debt 100000" },
    });

    const result = await commitPayment({ ...validInput, amount: 999000 });

    expect(result).toEqual({
      ok: false,
      code: "db_error",
      message: "Chưa ghi được, bác thử lại ạ.",
    });
  });

  it("rejects a non-positive amount without calling the rpc", async () => {
    const result = await commitPayment({ ...validInput, amount: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects when not authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await commitPayment(validInput);

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a generic database failure to db_error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await commitPayment(validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("db_error");
    }
  });

  // TIP-PAY-DATE (VĐ1) — ghi đúng ngày người dùng nói.
  it("passes the requested business_date to the rpc and view (AC1)", async () => {
    const result = await commitPayment({
      ...validInput,
      business_date: "2025-10-11",
    });

    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_payment");
    expect(params.p_business_date).toBe("2025-10-11");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.business_date).toBe("2025-10-11");
    }
  });

  it("defaults a null business_date to today VN without breaking (AC2)", async () => {
    // RPC bỏ trống business_date -> view dùng ngày đã resolve (hôm nay VN).
    mocks.rpc.mockResolvedValue({
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        idempotent_reuse: false,
      },
      error: null,
    });

    const result = await commitPayment({ ...validInput, business_date: null });

    const [, params] = mocks.rpc.mock.calls[0];
    expect(params.p_business_date).toBe(businessDateVN());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.business_date).toBe(businessDateVN());
    }
  });

  it("rejects a future business_date without calling the rpc (AC3)", async () => {
    const result = await commitPayment({
      ...validInput,
      business_date: "2999-12-31",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  // TIP-DC-4 — gắn nhãn nhóm (danh mục) cho cọc qua scope params.
  it("passes scope_category_id to the rpc when provided (AC1)", async () => {
    const result = await commitPayment({
      ...validInput,
      scope_category_id: "cat-1",
    });

    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_payment");
    expect(params.p_scope_category_id).toBe("cat-1");
    expect(params.p_scope_product_id).toBeNull();
    expect(result.ok).toBe(true);
  });

  it("defaults scope params to null when omitted (AC2)", async () => {
    await commitPayment(validInput);

    const [, params] = mocks.rpc.mock.calls[0];
    expect(params.p_scope_category_id).toBeNull();
    expect(params.p_scope_product_id).toBeNull();
  });

  it("maps a scope_category not found rpc error to validation_failed (AC3)", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "scope_category not found" },
    });

    const result = await commitPayment({
      ...validInput,
      scope_category_id: "cat-bad",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Nhóm không hợp lệ ạ.",
    });
  });

  it("maps a scope must be product OR category rpc error to validation_failed (AC3)", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "scope must be product OR category" },
    });

    const result = await commitPayment({
      ...validInput,
      scope_category_id: "cat-1",
      scope_product_id: "prod-1",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Nhóm không hợp lệ ạ.",
    });
  });

  // TIP-DC-4d — server resolve tên nhóm vào snapshot history card (scope_label).
  // Card được persist qua mocks.insert lần 2 (chat_messages) → metadata.card.
  function persistedHistoryCard() {
    const chatInsert = mocks.insert.mock.calls[1]?.[0] as
      | { metadata?: { card?: { scope_label?: string | null } } }
      | undefined;
    return chatInsert?.metadata?.card;
  }

  it("resolves scope_label from the payment's scope_category_id (DC-4d build snapshot)", async () => {
    historyPaymentBuilder = makeMaybeSingleBuilder({
      data: { customer_id: "cust-1", amount: "200000", scope_category_id: "cat-1" },
      error: null,
    });
    historyCategoryBuilder = makeMaybeSingleBuilder({
      data: { name: "Xi măng" },
      error: null,
    });

    const result = await commitPayment(validInput);

    expect(result.ok).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("product_categories");
    expect(historyCategoryBuilder.eq).toHaveBeenNthCalledWith(1, "owner_id", "user-a");
    expect(historyCategoryBuilder.eq).toHaveBeenNthCalledWith(2, "id", "cat-1");
    expect(historyCategoryBuilder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(persistedHistoryCard()?.scope_label).toBe("Xi măng");
  });

  it("leaves scope_label null when the payment has no scope_category_id (DC-4d)", async () => {
    // historyPaymentBuilder mặc định trả scope_category_id: null.
    const result = await commitPayment(validInput);

    expect(result.ok).toBe(true);
    expect(mocks.from).not.toHaveBeenCalledWith("product_categories");
    expect(persistedHistoryCard()?.scope_label).toBeNull();
  });

  it("leaves scope_label null for an orphan category (đã xóa mềm) (DC-4d)", async () => {
    historyPaymentBuilder = makeMaybeSingleBuilder({
      data: { customer_id: "cust-1", amount: "200000", scope_category_id: "cat-gone" },
      error: null,
    });
    // Danh mục đã deleted_at != null → query owner-scoped + is(deleted_at,null)
    // không thấy row → null.
    historyCategoryBuilder = makeMaybeSingleBuilder({ data: null, error: null });

    const result = await commitPayment(validInput);

    expect(result.ok).toBe(true);
    expect(persistedHistoryCard()?.scope_label).toBeNull();
  });
});
