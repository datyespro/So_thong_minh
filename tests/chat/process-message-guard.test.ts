import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  checkAiGuard: vi.fn(),
  runChatPipeline: vi.fn(),
  logAiInteraction: vi.fn(),
}));

const chatInsertChain = { insert: mocks.insert };

const supabase = {
  auth: { getUser: mocks.getUser },
  from: mocks.from,
};

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/src/lib/ai/cost-guard", () => ({
  checkAiGuard: mocks.checkAiGuard,
}));

vi.mock("@/src/lib/ai/chat-pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/ai/chat-pipeline")>();
  return { ...actual, runChatPipeline: mocks.runChatPipeline };
});

vi.mock("@/src/lib/ai/interaction-log", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/lib/ai/interaction-log")>();
  return { ...actual, logAiInteraction: mocks.logAiInteraction };
});

const { processMessage } = await import("@/app/(app)/chat/actions");

const userMessage = {
  id: "message-1",
  role: "user",
  content: "hello",
  created_at: "2026-06-15T00:00:00.000Z",
};

describe("processMessage cost guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.createClient.mockResolvedValue(supabase);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue(chatInsertChain);
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: userMessage,
      error: null,
    });
  });

  it("short-circuits when guard blocks, does not run pipeline, does not log interaction", async () => {
    mocks.checkAiGuard.mockResolvedValue({
      allow: false,
      reason: "rate_minute",
      message: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
    });

    const result = await processMessage("hello");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: {
        ok: false,
        stage: "extract",
        code: "rate_minute",
        message: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
      },
      terminalText: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
    });

    // Guard called
    expect(mocks.checkAiGuard).toHaveBeenCalledWith({
      supabase,
      ownerId: "user-a",
    });

    // Pipeline NOT called
    expect(mocks.runChatPipeline).not.toHaveBeenCalled();
    
    // Log NOT called
    expect(mocks.logAiInteraction).not.toHaveBeenCalled();

    // Verify it persisted the assistant message
    // 1 call for user message, 1 call for terminal assistant message
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: "Dạ bác gửi hơi nhanh, bác đợi một chút rồi thử lại giúp em ạ.",
      intent: "rate_minute",
      metadata: { source: "tip_d8b_cost_guard" },
    });
  });
});
