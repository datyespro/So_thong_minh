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
      },
      error: null,
    });
    historyCustomerBuilder = makeMaybeSingleBuilder({
      data: { name: "anh Tuấn" },
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
    expect(historyPaymentBuilder.select).toHaveBeenCalledWith("customer_id,amount");
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

  it("maps the overpayment guard to a friendly blocking message", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "payment 999000 exceeds current debt 100000" },
    });

    const result = await commitPayment({ ...validInput, amount: 999000 });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Số tiền trả lớn hơn số nợ hiện tại ạ.",
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
});
