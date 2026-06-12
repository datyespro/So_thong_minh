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
  readSelect: vi.fn(),
  readEq: vi.fn(),
  readIs: vi.fn(),
  single: vi.fn(),
  runChatPipeline: vi.fn(),
  logAiInteraction: vi.fn(),
  answerQuery: vi.fn(),
}));

const productReadChain = {
  select: mocks.readSelect,
  eq: mocks.readEq,
  is: mocks.readIs,
};

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

function nonePipeline(intent: "small_talk" | "unknown", rawText: string): ChatPipelineResult {
  if (!pipelineResult.ok) {
    throw new Error("Expected base pipeline fixture to be successful.");
  }

  return {
    ok: true,
    extracted: {
      ...extractedIntent,
      intent,
      raw_text: rawText,
      normalized_text: rawText,
      entities: {
        ...extractedIntent.entities,
        customer_name: null,
        product_name: null,
        items: [],
        amount: null,
      },
      next_stage_hint: intent === "small_talk" ? "answer_small_talk" : "reject",
    },
    validated: {
      ...pipelineResult.validated,
      intent,
      kind: "none",
      raw_text: rawText,
      customer: null,
      supplier: null,
      items: [],
      effective_amount: null,
      ready_for_preview: false,
    },
  };
}

function manageProductPipeline(
  productManagement: NonNullable<
    ExtractedIntent["entities"]["product_management"]
  >,
): ChatPipelineResult {
  const baseValidated = pipelineResult.ok ? pipelineResult.validated : null;
  const rawText =
    productManagement.action === "set_unit"
      ? `đổi đơn vị ${productManagement.product_raw} thành ${productManagement.unit}`
      : productManagement.action === "set_price"
        ? `đặt giá ${productManagement.product_raw} ${productManagement.sell_price}`
        : `thêm hàng ${productManagement.product_raw}`;

  if (!baseValidated) {
    throw new Error("Expected base pipeline fixture to be successful.");
  }

  return {
    ok: true,
    extracted: {
      ...extractedIntent,
      intent: "manage_product",
      raw_text: rawText,
      normalized_text: rawText,
      entities: {
        ...extractedIntent.entities,
        customer_name: null,
        product_name: productManagement.product_raw,
        product_management: productManagement,
        items: [],
        amount: null,
        payment_status: "unknown",
      },
    },
    validated: {
      ...baseValidated,
      intent: "manage_product",
      kind: "none",
      raw_text: rawText,
      customer: null,
      items: [],
      effective_amount: null,
      ready_for_preview: false,
    },
  };
}

describe("processMessage", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.select.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.single.mockReset();
    mocks.runChatPipeline.mockReset();
    mocks.logAiInteraction.mockReset();
    mocks.answerQuery.mockReset();

    mocks.createClient.mockResolvedValue(supabase);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue(chatInsertChain);
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.readSelect.mockReturnValue(productReadChain);
    mocks.readEq.mockReturnValue(productReadChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.single.mockResolvedValue({
      data: userMessage,
      error: null,
    });
    mocks.runChatPipeline.mockResolvedValue(pipelineResult);
    mocks.logAiInteraction.mockResolvedValue(undefined);
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

  it("returns turnId from the best-effort interaction log", async () => {
    mocks.logAiInteraction.mockResolvedValue("turn-123");

    const result = await processMessage("anh Hùng mua 20 bao xi măng");

    expect(result).toEqual({
      ok: true,
      userMessage,
      pipeline: pipelineResult,
      turnId: "turn-123",
    });
    expect(mocks.logAiInteraction).toHaveBeenCalledWith({
      supabase,
      ownerId: "user-a",
      rawText: "anh Hùng mua 20 bao xi măng",
      pipeline: pipelineResult,
      latencyMs: expect.any(Number),
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
    expect(mocks.answerQuery).not.toHaveBeenCalled();
  });

  it("persists small_talk terminal assistant text", async () => {
    const smallTalkPipeline = nonePipeline("small_talk", "hi");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "hi" },
      error: null,
    });

    const result = await processMessage("hi");

    expect(result).toEqual({
      ok: true,
      userMessage: { ...userMessage, content: "hi" },
      pipeline: smallTalkPipeline,
    });
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: "Dạ, em nghe ạ.",
      intent: "small_talk",
      metadata: { source: "tip_18a" },
    });
  });

  it("persists capability help with chips for matched none intent", async () => {
    const smallTalkPipeline = nonePipeline("small_talk", "lam duoc gi");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "lam duoc gi" },
      error: null,
    });

    const result = await processMessage("lam duoc gi");

    expect(result.ok).toBe(true);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content:
        "Dạ, em là Sổ Thông Minh — em thay cuốn sổ giấy của cửa hàng mình ạ. Bác cứ nhắn như nói chuyện: nhắn một câu là em ghi đơn bán, ghi thu nợ, ghi nhập hàng; hỏi một câu là em tra được khách nợ bao nhiêu, hôm nay bán được bao nhiêu, hàng còn bao nhiêu. Ghi nhầm thì bấm Hoàn tác ngay dưới thẻ. Bác bấm thử một ví dụ bên dưới ạ:",
      intent: "small_talk",
      metadata: {
        source: "tip_25a_capability",
        chips: [
          "Bán cho anh Hùng 5 bao xi măng 90k",
          "Anh Hùng trả 200k",
          "Nhập 20 bao xi măng của đại lý Thành giá 70k",
          "Anh Hùng nợ bao nhiêu?",
          "Hôm nay bán được bao nhiêu?",
          "Còn bao nhiêu xi măng?",
        ],
      },
    });
  });

  it("persists unknown terminal assistant text", async () => {
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
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: "Em chưa rõ ý câu này ạ.",
      intent: "unknown",
      metadata: { source: "tip_18a" },
    });
  });

  it("does not fail the response when assistant persistence fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const smallTalkPipeline = nonePipeline("small_talk", "hi");
    mocks.runChatPipeline.mockResolvedValue(smallTalkPipeline);
    mocks.single.mockResolvedValue({
      data: { ...userMessage, content: "hi" },
      error: null,
    });
    mocks.insert
      .mockReturnValueOnce({ select: mocks.select })
      .mockResolvedValueOnce({
        error: { code: "42501", message: "RLS denied" },
      });

    const result = await processMessage("hi");

    expect(result).toEqual({
      ok: true,
      userMessage: { ...userMessage, content: "hi" },
      pipeline: smallTalkPipeline,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist assistant terminal chat message",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
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

  it("attaches a not_found product-management preview for a 0-match set_unit", async () => {
    const productPipeline = manageProductPipeline({
      action: "set_unit",
      product_raw: "gạch siêu lạ",
      unit: "viên",
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-xi-mang",
          name: "Xi măng",
          aliases: [],
          unit: "bao",
          sell_price: null,
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("đổi đơn vị gạch siêu lạ thành viên");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "not_found",
        action: "set_unit",
        product_raw: "gạch siêu lạ",
      });
    }
    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.readSelect).toHaveBeenCalledWith("id,name,aliases,unit,sell_price");
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.readIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("logs the pipeline before a product-management preview failure returns", async () => {
    const productPipeline = manageProductPipeline({
      action: "set_unit",
      product_raw: "xi măng",
      unit: "bao",
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.logAiInteraction.mockResolvedValue("turn-before-preview-error");
    mocks.readIs.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "RLS denied" },
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("đổi đơn vị xi măng thành bao");

    expect(result).toEqual({
      ok: false,
      code: "db_error",
      message: "Chưa tìm được hàng, bác thử lại ạ.",
    });
    expect(mocks.logAiInteraction).toHaveBeenCalledTimes(1);
    expect(mocks.logAiInteraction.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readIs.mock.invocationCallOrder[0],
    );
  });

  it("attaches a ready product-management preview for a 1-match set_unit", async () => {
    const productPipeline = manageProductPipeline({
      action: "set_unit",
      product_raw: "xi măng",
      unit: "bao",
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-xi-mang",
          name: "Xi măng",
          aliases: [],
          unit: "cái",
          sell_price: null,
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("đổi đơn vị xi măng thành bao");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "ready",
        action: "set_unit",
        product: {
          id: "product-xi-mang",
          name: "Xi măng",
          unit: "cái",
          sell_price: null,
        },
        target: { unit: "bao" },
      });
    }
  });

  it("attaches a ready product-management preview for a 1-match set_price", async () => {
    const productPipeline = manageProductPipeline({
      action: "set_price",
      product_raw: "xi măng",
      unit: null,
      sell_price: 85000,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-xi-mang",
          name: "Xi măng",
          aliases: [],
          unit: "bao",
          sell_price: "70000",
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("đặt giá xi măng 85000");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "ready",
        action: "set_price",
        product: {
          id: "product-xi-mang",
          name: "Xi măng",
          unit: "bao",
          sell_price: 70000,
        },
        target: { sell_price: 85000 },
      });
    }
  });

  it("attaches a needs_choice preview when product aliases match multiple rows", async () => {
    const productPipeline = manageProductPipeline({
      action: "set_unit",
      product_raw: "xi măng",
      unit: "bao",
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-xi-mang-a",
          name: "Xi măng A",
          aliases: ["xi măng"],
          unit: "cái",
          sell_price: null,
        },
        {
          id: "product-xi-mang-b",
          name: "Xi măng B",
          aliases: ["xi măng"],
          unit: "bao",
          sell_price: "90000",
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("đổi đơn vị xi măng thành bao");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toMatchObject({
        status: "needs_choice",
        action: "set_unit",
        product_raw: "xi măng",
        target: { unit: "bao" },
      });
      expect(
        result.productManagementPreview?.status === "needs_choice"
          ? result.productManagementPreview.candidates
          : [],
      ).toEqual([
        expect.objectContaining({
          id: "product-xi-mang-a",
          name: "Xi măng A",
          unit: "cái",
          sell_price: null,
        }),
        expect.objectContaining({
          id: "product-xi-mang-b",
          name: "Xi măng B",
          unit: "bao",
          sell_price: 90000,
        }),
      ]);
    }
  });

  it("attaches a create_duplicate product-management preview when the product already exists", async () => {
    const productPipeline = manageProductPipeline({
      action: "create",
      product_raw: "gạch đỏ",
      unit: null,
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-gach-do",
          name: "Gạch đỏ",
          unit: "viên",
          sell_price: "2000",
        },
      ],
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("thêm hàng gạch đỏ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "create_duplicate",
        action: "create",
        product_raw: "gạch đỏ",
        product: {
          id: "product-gach-do",
          name: "Gạch đỏ",
          unit: "viên",
          sell_price: 2000,
        },
      });
    }
    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.readSelect).toHaveBeenCalledWith("id,name,unit,sell_price");
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.readIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("attaches a create_draft product-management preview for a new product", async () => {
    const productPipeline = manageProductPipeline({
      action: "create",
      product_raw: "gạch đỏ",
      unit: null,
      sell_price: null,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("thêm hàng gạch đỏ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "create_draft",
        action: "create",
        product_raw: "gạch đỏ",
        draft: {
          name: "gạch đỏ",
          unit: "cái",
          sell_price: null,
        },
      });
    }
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.readSelect).toHaveBeenCalledWith("id,name,unit,sell_price");
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.readIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("prefills create_draft unit and sell_price when extractor returns them", async () => {
    const productPipeline = manageProductPipeline({
      action: "create",
      product_raw: "sơn Dulux",
      unit: "thùng",
      sell_price: 85000,
    });
    mocks.runChatPipeline.mockResolvedValue(productPipeline);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.from
      .mockReturnValueOnce(chatInsertChain)
      .mockReturnValueOnce(productReadChain);

    const result = await processMessage("thêm hàng sơn Dulux");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.productManagementPreview).toEqual({
        status: "create_draft",
        action: "create",
        product_raw: "sơn Dulux",
        draft: {
          name: "sơn Dulux",
          unit: "thùng",
          sell_price: 85000,
        },
      });
    }
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenCalledWith("products");
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
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      content: "anh Hùng đang nợ 400.000 đ",
      intent: "query",
      metadata: {
        source: "tip_18a",
        query_subject: "debt",
      },
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
