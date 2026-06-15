import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatPipelineResult } from "@/src/lib/ai/chat-pipeline";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  runChatPipeline: vi.fn(),
  logAiInteraction: vi.fn(),
  answerQuery: vi.fn(),
  generateSmallTalkReply: vi.fn(),
}));

const chatInsertChain = {
  insert: mocks.insert,
};

const supabase = {
  auth: {
    getUser: mocks.getUser,
  },
  from: mocks.from,
};

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/src/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/src/lib/ai/chat-pipeline", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/chat-pipeline")>();

  return {
    ...actual,
    runChatPipeline: mocks.runChatPipeline,
  };
});

vi.mock("@/src/lib/ai/interaction-log", () => ({
  logAiInteraction: mocks.logAiInteraction,
}));

vi.mock("@/src/lib/ai/answer-query", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/answer-query")>();

  return {
    ...actual,
    answerQuery: mocks.answerQuery,
  };
});

vi.mock("@/src/lib/ai/small-talk-reply", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/small-talk-reply")>();

  return {
    ...actual,
    generateSmallTalkReply: mocks.generateSmallTalkReply,
  };
});

const { processMessage } = await import("@/app/(app)/chat/actions");

const userMessage = {
  id: "message-1",
  role: "user",
  content: "chào em",
  created_at: "2026-06-11T03:00:00.000Z",
};

function nonePipeline(
  intent: "small_talk" | "unknown",
  rawText: string,
): ChatPipelineResult {
  const extracted: ExtractedIntent = {
    intent,
    confidence: 0.9,
    raw_text: rawText,
    normalized_text: rawText,
    language: "vi",
    entities: {
      customer_name: null,
      supplier_name: null,
      product_name: null,
      product_management: null,
      items: [],
      amount: null,
      paid_amount: null,
      payment_status: "unknown",
      payment_method: null,
      order_reference: null,
      business_date: null,
      time_range: {
        raw: null,
        kind: "unknown",
        start_date: null,
        end_date: null,
      },
    },
    missing_info: [],
    warnings: [],
    needs_confirmation: false,
    next_stage_hint: intent === "small_talk" ? "answer_small_talk" : "reject",
  };

  return {
    ok: true,
    extracted,
    validated: {
      intent,
      kind: "none",
      raw_text: rawText,
      customer: null,
      supplier: null,
      items: [],
      effective_amount: null,
      effective_paid: null,
      issues: [],
      ready_for_preview: false,
      blocking_count: 0,
      warning_count: 0,
    },
  };
}

describe("processMessage small_talk LLM branch (tip 25b)", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.select.mockReset();
    mocks.single.mockReset();
    mocks.runChatPipeline.mockReset();
    mocks.logAiInteraction.mockReset();
    mocks.answerQuery.mockReset();
    mocks.generateSmallTalkReply.mockReset();

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
    mocks.generateSmallTalkReply.mockResolvedValue(null);
    mocks.logAiInteraction.mockResolvedValue(undefined);
  });

  it("persists the LLM reply with tip_25b source and returns terminalText", async () => {
    const llmText = "Dạ em chào bác, bác cần ghi gì cứ nhắn em ạ.";
    const smallTalkPipeline = nonePipeline("small_talk", "chào em");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.generateSmallTalkReply.mockResolvedValue(llmText);

    const result = await processMessage("chào em");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: smallTalkPipeline,
      terminalText: llmText,
    });
    expect(mocks.generateSmallTalkReply).toHaveBeenCalledTimes(1);
    expect(mocks.generateSmallTalkReply).toHaveBeenCalledWith({
      rawText: "chào em",
    });
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: llmText,
      intent: "small_talk",
      metadata: { source: "tip_25b_small_talk" },
    });
  });

  it("falls back to the legacy terminal text without a terminalText field when the LLM returns null", async () => {
    const smallTalkPipeline = nonePipeline("small_talk", "chào em");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.generateSmallTalkReply.mockResolvedValue(null);

    const result = await processMessage("chào em");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: smallTalkPipeline,
    });
    expect(result.ok && "terminalText" in result).toBe(false);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: "Dạ, em nghe ạ.",
      intent: "small_talk",
      metadata: { source: "tip_18a" },
    });
  });

  it("does not call the LLM when the capability detector matches", async () => {
    const smallTalkPipeline = nonePipeline("small_talk", "lam duoc gi");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "lam duoc gi" },
      error: null,
    });

    const result = await processMessage("lam duoc gi");

    expect(result.ok).toBe(true);
    expect(mocks.generateSmallTalkReply).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      intent: "small_talk",
      metadata: expect.objectContaining({ source: "tip_25a_capability" }),
    });
  });

  it("does not call the LLM for unknown intent", async () => {
    const unknownPipeline = nonePipeline("unknown", "???");
    mocks.runChatPipeline.mockResolvedValue(unknownPipeline);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "???" },
      error: null,
    });

    const result = await processMessage("???");

    expect(result).toEqual({
      ok: true,
      userMessage: { ...userMessage, content: "???" },
      pipeline: unknownPipeline,
    });
    expect(mocks.generateSmallTalkReply).not.toHaveBeenCalled();
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      content: "Em chưa rõ ý câu này ạ.",
      intent: "unknown",
      metadata: { source: "tip_18a" },
    });
  });

  it("keeps terminalText when persisting the LLM reply fails (best-effort)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const llmText = "Dạ em chào bác ạ.";
    const smallTalkPipeline = nonePipeline("small_talk", "chào em");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.generateSmallTalkReply.mockResolvedValue(llmText);
    mocks.insert
      .mockReturnValueOnce({ select: mocks.select })
      .mockResolvedValueOnce({
        error: { code: "42501", message: "RLS denied" },
      });

    const result = await processMessage("chào em");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: smallTalkPipeline,
      terminalText: llmText,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist assistant terminal chat message",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
  });
});
