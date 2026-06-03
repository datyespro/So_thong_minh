import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  })),
}));

const { commitPayment } = await import("@/app/(app)/chat/actions");

const validInput = {
  idempotency_key: "idem-1",
  customer_id: "cust-1",
  amount: 200000,
  raw_input: "anh Tuấn trả 200k",
};

describe("commitPayment", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: {
        payment_id: "payment-1",
        amount: 200000,
        new_debt_total: 100000,
        idempotent_reuse: false,
      },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
  });

  it("records the payment and logs payment_created telemetry", async () => {
    const result = await commitPayment(validInput);

    expect(result).toEqual({
      ok: true,
      data: { payment_id: "payment-1", amount: 200000, new_debt_total: 100000 },
    });

    const [fnName, params] = mocks.rpc.mock.calls[0];
    expect(fnName).toBe("commit_payment");
    expect(params.p_idempotency_key).toBe("idem-1");
    expect(params.p_customer_id).toBe("cust-1");
    expect(params.p_amount).toBe(200000);
    expect(params.p_method).toBeNull();

    expect(mocks.from).toHaveBeenCalledWith("usage_events");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      event_type: "payment_created",
    });
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
});
