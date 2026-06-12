import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { undoCommit } = await import("@/app/(app)/chat/actions");

describe("undoCommit", () => {
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
      data: { status: "voided", already_undone: false, new_debt_total: 100000 },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.updateAiInteractionOutcome.mockResolvedValue(undefined);
  });

  it("routes order/payment/purchase to the right rpc and logs undo telemetry", async () => {
    await undoCommit("order", "order-1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("undo_order", { p_order_id: "order-1" });

    await undoCommit("payment", "pay-1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("undo_payment", { p_payment_id: "pay-1" });

    await undoCommit("purchase", "pur-1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("undo_purchase", {
      p_purchase_id: "pur-1",
    });

    expect(mocks.from).toHaveBeenCalledWith("usage_events");
    expect(mocks.insert).toHaveBeenLastCalledWith({
      owner_id: "user-a",
      event_type: "undo",
    });
  });

  it("marks the AI interaction undone when aiTurnId is present", async () => {
    const result = await undoCommit("order", "order-1", "turn-order");

    expect(result.ok).toBe(true);
    expect(mocks.updateAiInteractionOutcome).toHaveBeenCalledWith({
      supabase: expect.objectContaining({ from: mocks.from }),
      ownerId: "user-a",
      aiTurnId: "turn-order",
      outcome: "undone",
    });
  });

  it("returns ok with already_undone when the rpc reports an idempotent no-op", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "voided", already_undone: true, new_debt_total: 100000 },
      error: null,
    });

    const result = await undoCommit("order", "order-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.already_undone).toBe(true);
      expect(result.data.kind).toBe("order");
    }
  });

  it("rejects when not authenticated and never calls the rpc", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await undoCommit("order", "order-1");

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a missing id without calling the rpc", async () => {
    const result = await undoCommit("order", "");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a database failure to db_error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await undoCommit("payment", "pay-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("db_error");
    }
  });
});
