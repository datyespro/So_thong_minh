import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseHistoryCommitCard } from "@/src/lib/chat/history-card";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

const { markChatMessageUndone } = await import("@/app/(app)/chat/actions");

// metadata thẻ cọc đã commit: card + source. mark KHÔNG được làm mất card.
const paymentCardMetadata = {
  source: "tip_18b",
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
    scope_label: "Xi măng",
  },
};

describe("markChatMessageUndone", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.update.mockReset();
    mocks.eq.mockReset();
    mocks.maybeSingle.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    // Builder dùng chung cho cả đường select lẫn update (đều trên chat_messages).
    const builder: Record<string, unknown> = {};
    builder.select = mocks.select.mockReturnValue(builder);
    builder.update = mocks.update.mockReturnValue(builder);
    builder.eq = mocks.eq.mockReturnValue(builder);
    builder.maybeSingle = mocks.maybeSingle.mockResolvedValue({
      data: { metadata: paymentCardMetadata },
      error: null,
    });
    mocks.from.mockReturnValue(builder);
  });

  it("UPDATE chat_messages owner-scoped, set metadata.undone=true, giữ nguyên card", async () => {
    await markChatMessageUndone("m1");

    // CHỈ đụng chat_messages — KHÔNG payments/orders/RPC nợ.
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenNthCalledWith(1, "chat_messages");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "chat_messages");

    // Owner-scoped: lọc theo id + owner_id ở cả đọc lẫn ghi.
    expect(mocks.eq).toHaveBeenCalledWith("id", "m1");
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", "user-a");

    // Payload UPDATE: merge cờ undone, giữ source + card.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const updatePayload = mocks.update.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
    };
    expect(updatePayload.metadata.undone).toBe(true);
    expect(updatePayload.metadata.source).toBe("tip_18b");
    expect(updatePayload.metadata.card).toEqual(paymentCardMetadata.card);

    // Must-do: thẻ vẫn parse được sau khi merge cờ.
    const parsed = parseHistoryCommitCard(updatePayload.metadata);
    expect(parsed).not.toBeNull();
    expect(parsed?.source_id).toBe("payment-1");
    expect(parsed?.scope_label).toBe("Xi măng");
  });

  it("nuốt êm khi chưa đăng nhập (best-effort, không UPDATE)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(markChatMessageUndone("m1")).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("bỏ qua messageId rỗng mà không gọi DB", async () => {
    await markChatMessageUndone("");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("nuốt êm khi không tìm thấy message (best-effort, không UPDATE)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(markChatMessageUndone("m1")).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
