import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  updateAiInteractionOutcome: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
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

const { persistDismissedPreviewMessage } = await import("@/app/(app)/chat/actions");

const validCard = {
  v: 1,
  kind: "record_payment",
  entity_name: "chị Lan",
  business_date: null,
  total_amount: null,
  debt_amount: null,
  amount: 500000,
  items: null,
  source_id: null,
};

describe("persistDismissedPreviewMessage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.updateAiInteractionOutcome.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.updateAiInteractionOutcome.mockResolvedValue(undefined);
  });

  it("requires auth and does not insert", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await persistDismissedPreviewMessage({
      intent: "create_order",
      content: "Đã bỏ đơn của khách",
      card: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("inserts one dismissed assistant row with a validated history card", async () => {
    const result = await persistDismissedPreviewMessage({
      intent: "record_payment",
      content: "Đã bỏ thu nợ của chị Lan",
      card: validCard,
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(mocks.from).toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      role: "assistant",
      content: "Đã bỏ thu nợ của chị Lan",
      intent: "record_payment",
      metadata: {
        card: validCard,
        source: "tip_22_dismiss",
      },
    });
  });

  it("marks the AI interaction dismissed when ai_turn_id is present", async () => {
    const result = await persistDismissedPreviewMessage({
      intent: "record_payment",
      content: "Đã bỏ thu nợ của chị Lan",
      card: validCard,
      ai_turn_id: "turn-payment",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(mocks.updateAiInteractionOutcome).toHaveBeenCalledWith({
      supabase: expect.objectContaining({ from: mocks.from }),
      ownerId: "user-a",
      aiTurnId: "turn-payment",
      outcome: "dismissed",
    });
  });

  it("persists text-only when the client card is invalid", async () => {
    const result = await persistDismissedPreviewMessage({
      intent: "create_order",
      content: "Đã bỏ đơn của khách",
      card: { v: 2 },
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      role: "assistant",
      content: "Đã bỏ đơn của khách",
      intent: "create_order",
      metadata: {
        source: "tip_22_dismiss",
      },
    });
  });

  it("does not throw when the best-effort insert fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.insert.mockResolvedValue({
      error: { code: "42501", message: "RLS denied" },
    });

    const result = await persistDismissedPreviewMessage({
      intent: "create_purchase",
      content: "Đã bỏ nhập hàng",
      card: null,
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist assistant terminal chat message",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
  });
});
