import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatPipelineResult } from "@/src/lib/ai/chat-pipeline";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  runChatPipeline: vi.fn(),
}));

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

const { processMessage } = await import("@/app/(app)/chat/actions");

const userMessage = {
  id: "message-1",
  role: "user",
  content: "anh Hùng mua 20 bao xi măng",
  created_at: "2026-05-29T03:00:00.000Z",
};

const pipelineResult: ChatPipelineResult = {
  ok: true,
  validated: {
    intent: "create_order",
    kind: "writable",
    raw_text: "anh Hùng mua 20 bao xi măng",
    customer: {
      raw: "anh Hùng",
      entity_type: "customer",
      status: "resolved",
      resolved_id: "customer-hung",
      resolved_name: "anh Hùng",
      confidence: 1,
      candidates: [],
    },
    supplier: null,
    items: [],
    effective_amount: null,
    issues: [],
    ready_for_preview: false,
    blocking_count: 0,
    warning_count: 0,
  },
};

describe("processMessage", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.select.mockReset();
    mocks.single.mockReset();
    mocks.runChatPipeline.mockReset();

    mocks.createClient.mockResolvedValue(supabase);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: userMessage,
      error: null,
    });
    mocks.runChatPipeline.mockResolvedValue(pipelineResult);
  });

  it("returns the save failure and does not run pipeline", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await processMessage("anh Hùng mua 20 bao xi măng");

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.runChatPipeline).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns the saved user message and pipeline result", async () => {
    const result = await processMessage("  anh Hùng mua 20 bao xi măng  ");

    expect(result).toEqual({
      ok: true,
      userMessage: {
        id: "message-1",
        role: "user",
        content: "anh Hùng mua 20 bao xi măng",
        created_at: "2026-05-29T03:00:00.000Z",
      },
      pipeline: pipelineResult,
    });
    expect(mocks.createClient).toHaveBeenCalledTimes(2);
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(mocks.runChatPipeline).toHaveBeenCalledWith({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "user-a",
      supabase,
    });
  });

  it("keeps the saved user message when pipeline returns a friendly error", async () => {
    const pipelineError: ChatPipelineResult = {
      ok: false,
      stage: "extract",
      code: "extract_failed",
      message: "Em chưa đọc được câu này, bác thử nói lại gọn hơn giúp em ạ.",
    };
    mocks.runChatPipeline.mockResolvedValue(pipelineError);

    const result = await processMessage("anh Hùng mua 20 bao xi măng");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: pipelineError,
    });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("only inserts one user chat row and never touches service-role paths", async () => {
    await processMessage("anh Hùng mua 20 bao xi măng");

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("chat_messages");
    expect(mocks.from).not.toHaveBeenCalledWith("pending_previews");
    expect(mocks.createAdminClient).not.toHaveBeenCalled();

    const inserted = mocks.insert.mock.calls[0][0];

    expect(Array.isArray(inserted)).toBe(false);
    expect(inserted).toMatchObject({
      owner_id: "user-a",
      role: "user",
      content: "anh Hùng mua 20 bao xi măng",
      intent: null,
    });
  });
});
