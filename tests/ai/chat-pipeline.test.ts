import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ResolvedIntent } from "@/src/lib/ai/resolve-schema";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";

const mocks = vi.hoisted(() => ({
  extractIntent: vi.fn(),
  resolveEntities: vi.fn(),
  validateIntent: vi.fn(),
}));

vi.mock("@/src/lib/ai/extract-intent", () => ({
  extractIntent: mocks.extractIntent,
}));

vi.mock("@/src/lib/ai/resolve-entities", () => ({
  resolveEntities: mocks.resolveEntities,
}));

vi.mock("@/src/lib/ai/validate-intent", () => ({
  validateIntent: mocks.validateIntent,
}));

const { guardSymbolOnlyWritableIntent, runChatPipeline } = await import(
  "@/src/lib/ai/chat-pipeline"
);

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
    items: [
      {
        raw: "20 bao xi măng",
        product_name: "xi măng",
        quantity: 20,
        unit: "bao",
        unit_price: null,
        line_total: null,
        confidence: 0.9,
      },
    ],
    amount: 1600000,
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

const resolvedIntent: ResolvedIntent = {
  intent: "create_order",
  raw_text: "anh Hùng mua 20 bao xi măng",
  amount: 1600000,
  payment_status: "unknown",
  payment_method: null,
  customer: {
    raw: "anh Hùng",
    entity_type: "customer",
    status: "resolved",
    resolved_id: "customer-hung",
    resolved_name: "anh Hùng",
    confidence: 1,
    candidates: [],
  },
  supplier: {
    raw: null,
    entity_type: "supplier",
    status: "not_found",
    resolved_id: null,
    resolved_name: null,
    confidence: 0,
    candidates: [],
  },
  items: [
    {
      raw: "20 bao xi măng",
      product_name: "xi măng",
      quantity: 20,
      unit: "bao",
      unit_price: null,
      line_total: null,
      confidence: 0.9,
      resolution: {
        raw: "xi măng",
        entity_type: "product",
        status: "resolved",
        resolved_id: "product-xi-mang",
        resolved_name: "xi măng",
        confidence: 1,
        candidates: [],
      },
    },
  ],
  overall_status: "all_resolved",
  needs_confirmation: false,
};

const validatedIntent: ValidatedIntent = {
  intent: "create_order",
  kind: "writable",
  raw_text: "anh Hùng mua 20 bao xi măng",
  customer: resolvedIntent.customer,
  supplier: resolvedIntent.supplier,
  items: [
    {
      ...resolvedIntent.items[0],
      effective_quantity: 20,
      effective_unit: "bao",
      effective_unit_price: 80000,
      line_total: 1600000,
      issues: [],
    },
  ],
  effective_amount: 1600000,
  issues: [],
  ready_for_preview: true,
  blocking_count: 0,
  warning_count: 0,
};

describe("guardSymbolOnlyWritableIntent", () => {
  function extractedWithRaw(
    rawText: string,
    intent: ExtractedIntent["intent"] = "create_order",
  ): ExtractedIntent {
    return {
      ...extractedIntent,
      intent,
      raw_text: rawText,
      normalized_text: rawText,
    };
  }

  it.each(["...", "?", "..??..", "---", "!!!"])(
    "overrides symbol-only writable input %s to unknown",
    (rawText) => {
      const guarded = guardSymbolOnlyWritableIntent(extractedWithRaw(rawText));

      expect(guarded.intent).toBe("unknown");
      expect(guarded.raw_text).toBe(rawText);
      expect(guarded.entities.customer_name).toBeNull();
      expect(guarded.entities.items).toEqual([]);
      expect(guarded.next_stage_hint).toBe("reject");
    },
  );

  it("keeps shorthand sale orders with Vietnamese letters and numbers", () => {
    const extracted = extractedWithRaw("Hùng 5 bao xi măng");

    expect(guardSymbolOnlyWritableIntent(extracted)).toBe(extracted);
  });

  it("keeps alphabetic gibberish for the model and validator to handle", () => {
    const extracted = extractedWithRaw("abc");

    expect(guardSymbolOnlyWritableIntent(extracted)).toBe(extracted);
  });

  it("does not touch non-writable intents even when the raw text is symbol-only", () => {
    const extracted = extractedWithRaw("...", "small_talk");

    expect(guardSymbolOnlyWritableIntent(extracted)).toBe(extracted);
  });
});

describe("runChatPipeline", () => {
  const supabase = {
    from: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabase.from.mockReset();
    mocks.extractIntent.mockReset();
    mocks.resolveEntities.mockReset();
    mocks.validateIntent.mockReset();
    mocks.extractIntent.mockResolvedValue(extractedIntent);
    mocks.resolveEntities.mockResolvedValue(resolvedIntent);
    mocks.validateIntent.mockResolvedValue(validatedIntent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs extract, resolve, and validate in order", async () => {
    const order: string[] = [];
    mocks.extractIntent.mockImplementation(async () => {
      order.push("extract");
      return extractedIntent;
    });
    mocks.resolveEntities.mockImplementation(async () => {
      order.push("resolve");
      return resolvedIntent;
    });
    mocks.validateIntent.mockImplementation(async () => {
      order.push("validate");
      return validatedIntent;
    });

    const result = await runChatPipeline({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: true,
      extracted: extractedIntent,
      validated: validatedIntent,
    });
    expect(order).toEqual(["extract", "resolve", "validate"]);
    expect(mocks.extractIntent).toHaveBeenCalledWith({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "owner-1",
    });
    expect(mocks.resolveEntities).toHaveBeenCalledWith({
      intent: extractedIntent,
      ownerId: "owner-1",
      supabase,
    });
    expect(mocks.validateIntent).toHaveBeenCalledWith({
      resolved: resolvedIntent,
      ownerId: "owner-1",
      supabase,
    });
  });

  it("guards symbol-only writable extraction before resolve", async () => {
    const hallucinatedExtracted: ExtractedIntent = {
      ...extractedIntent,
      raw_text: "...",
      normalized_text: "...",
    };
    const unknownResolved: ResolvedIntent = {
      ...resolvedIntent,
      intent: "unknown",
      raw_text: "...",
      amount: null,
      customer: null,
      supplier: null,
      items: [],
      overall_status: "all_resolved",
      needs_confirmation: false,
    };
    const unknownValidated: ValidatedIntent = {
      ...validatedIntent,
      intent: "unknown",
      kind: "none",
      raw_text: "...",
      customer: null,
      supplier: null,
      items: [],
      effective_amount: null,
      issues: [],
      ready_for_preview: false,
      blocking_count: 0,
      warning_count: 0,
    };
    mocks.extractIntent.mockResolvedValue(hallucinatedExtracted);
    mocks.resolveEntities.mockResolvedValue(unknownResolved);
    mocks.validateIntent.mockResolvedValue(unknownValidated);

    const result = await runChatPipeline({
      rawText: "...",
      ownerId: "owner-1",
      supabase,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extracted.intent).toBe("unknown");
      expect(result.extracted.entities.items).toEqual([]);
      expect(result.validated.kind).toBe("none");
    }
    expect(mocks.resolveEntities).toHaveBeenCalledWith({
      intent: expect.objectContaining({
        intent: "unknown",
        raw_text: "...",
        entities: expect.objectContaining({ items: [] }),
      }),
      ownerId: "owner-1",
      supabase,
    });
  });

  it("short-circuits when extract fails", async () => {
    mocks.extractIntent.mockRejectedValue(new Error("missing key"));

    const result = await runChatPipeline({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: false,
      stage: "extract",
      code: "extract_failed",
      message: "Em chưa đọc được câu này, bác thử nói lại gọn hơn giúp em ạ.",
    });
    expect(mocks.resolveEntities).not.toHaveBeenCalled();
    expect(mocks.validateIntent).not.toHaveBeenCalled();
  });

  it("short-circuits when resolve fails", async () => {
    mocks.resolveEntities.mockRejectedValue(new Error("db unavailable"));

    const result = await runChatPipeline({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: false,
      stage: "resolve",
      code: "resolve_failed",
      message: "Em chưa tra được tên trong câu, bác thử lại ạ.",
    });
    expect(mocks.validateIntent).not.toHaveBeenCalled();
  });

  it("returns the friendly validate failure without exposing details", async () => {
    mocks.validateIntent.mockRejectedValue(new Error("master query failed"));

    const result = await runChatPipeline({
      rawText: "anh Hùng mua 20 bao xi măng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: false,
      stage: "validate",
      code: "validate_failed",
      message: "Em chưa kiểm được đơn, bác thử lại ạ.",
    });
  });

  it("returns ok=true when validation has blocking issues", async () => {
    const blockedValidated: ValidatedIntent = {
      ...validatedIntent,
      issues: [
        {
          code: "missing_customer",
          severity: "blocking",
          message: "Chưa rõ khách hàng.",
          field_path: "customer",
          item_index: null,
        },
      ],
      ready_for_preview: false,
      blocking_count: 1,
    };
    mocks.validateIntent.mockResolvedValue(blockedValidated);

    const result = await runChatPipeline({
      rawText: "bán 20 bao xi măng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: true,
      extracted: extractedIntent,
      validated: blockedValidated,
    });
  });

  it("returns ok=true for small talk intents", async () => {
    const smallTalkExtracted: ExtractedIntent = {
      ...extractedIntent,
      intent: "small_talk",
      entities: {
        ...extractedIntent.entities,
        customer_name: null,
        product_name: null,
        items: [],
        amount: null,
      },
      next_stage_hint: "answer_small_talk",
    };
    const smallTalkResolved: ResolvedIntent = {
      ...resolvedIntent,
      intent: "small_talk",
      amount: null,
      customer: null,
      supplier: null,
      items: [],
      overall_status: "all_resolved",
      needs_confirmation: false,
    };
    const smallTalkValidated: ValidatedIntent = {
      ...validatedIntent,
      intent: "small_talk",
      kind: "none",
      customer: null,
      supplier: null,
      items: [],
      effective_amount: null,
      issues: [],
      ready_for_preview: false,
      blocking_count: 0,
      warning_count: 0,
    };
    mocks.extractIntent.mockResolvedValue(smallTalkExtracted);
    mocks.resolveEntities.mockResolvedValue(smallTalkResolved);
    mocks.validateIntent.mockResolvedValue(smallTalkValidated);

    const result = await runChatPipeline({
      rawText: "chào buổi sáng",
      ownerId: "owner-1",
      supabase,
    });

    expect(result).toEqual({
      ok: true,
      extracted: smallTalkExtracted,
      validated: smallTalkValidated,
    });
  });
});
