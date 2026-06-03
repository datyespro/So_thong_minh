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
  answerQuery: vi.fn(),
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

vi.mock("@/src/lib/ai/answer-query", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/answer-query")>();

  return {
    ...actual,
    answerQuery: mocks.answerQuery,
  };
});

const { processMessage } = await import("@/app/(app)/chat/actions");

const userMessage = {
  id: "message-1",
  role: "user",
  content: "anh Hùng mua 20 bao xi măng",
  created_at: "2026-05-29T03:00:00.000Z",
};

const extractedIntent: ExtractedIntent = {
  intent: "create_order",
  confidence: 0.93,
  raw_text: "anh Hùng mua 20 bao xi măng",
  normalized_text: "anh hùng mua 20 bao xi măng",
  language: "vi",
  entities: {
    customer_name: "anh Hùng",
    supplier_name: null,
    product_name: "xi măng",
    product_management: null,
    items: [],
    amount: null,
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
  next_stage_hint: "resolve_entities",
};

const pipelineResult: ChatPipelineResult = {
  ok: true,
  extracted: extractedIntent,
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
    mocks.answerQuery.mockReset();

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
    expect(mocks.answerQuery).not.toHaveBeenCalled();
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
    expect(mocks.answerQuery).not.toHaveBeenCalled();
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

  it("attaches a deterministic answer for supported query intents", async () => {
    const queryPipeline: ChatPipelineResult = {
      ok: true,
      extracted: {
        ...extractedIntent,
        intent: "query_debt",
        raw_text: "anh Hùng nợ bao nhiêu",
        entities: {
          ...extractedIntent.entities,
          customer_name: "anh Hùng",
          product_name: null,
        },
      },
      validated: {
        ...pipelineResult.validated,
        intent: "query_debt",
        kind: "query",
        raw_text: "anh Hùng nợ bao nhiêu",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      },
    };
    const answer = {
      type: "debt" as const,
      state: "found" as const,
      customerName: "anh Hùng",
      debt: 400000,
      lastOrderAt: null,
      lastPaymentAt: null,
    };
    mocks.runChatPipeline.mockResolvedValue(queryPipeline);
    mocks.answerQuery.mockResolvedValue(answer);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "anh Hùng nợ bao nhiêu" },
      error: null,
    });

    const result = await processMessage("anh Hùng nợ bao nhiêu");

    expect(result).toEqual({
      ok: true,
      userMessage: { ...userMessage, content: "anh Hùng nợ bao nhiêu" },
      pipeline: queryPipeline,
      answer,
    });
    expect(mocks.answerQuery).toHaveBeenCalledWith({
      extracted: queryPipeline.extracted,
      validated: queryPipeline.validated,
      ownerId: "user-a",
      supabase,
    });
  });

  it("attaches a deterministic answer for inventory query intents", async () => {
    const queryPipeline: ChatPipelineResult = {
      ok: true,
      extracted: {
        ...extractedIntent,
        intent: "query_inventory",
        raw_text: "còn bao nhiêu xi măng",
        entities: {
          ...extractedIntent.entities,
          customer_name: null,
          product_name: "xi măng",
        },
      },
      validated: {
        ...pipelineResult.validated,
        intent: "query_inventory",
        kind: "query",
        raw_text: "còn bao nhiêu xi măng",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      },
    };
    const answer = {
      type: "inventory" as const,
      state: "found" as const,
      productName: "xi măng",
      stock: 144,
      unit: "bao",
    };
    mocks.runChatPipeline.mockResolvedValue(queryPipeline);
    mocks.answerQuery.mockResolvedValue(answer);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "còn bao nhiêu xi măng" },
      error: null,
    });

    const result = await processMessage("còn bao nhiêu xi măng");

    expect(result).toEqual({
      ok: true,
      userMessage: { ...userMessage, content: "còn bao nhiêu xi măng" },
      pipeline: queryPipeline,
      answer,
    });
    expect(mocks.answerQuery).toHaveBeenCalledWith({
      extracted: queryPipeline.extracted,
      validated: queryPipeline.validated,
      ownerId: "user-a",
      supabase,
    });
  });
});
