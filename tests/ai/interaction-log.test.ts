import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatPipelineResult } from "@/src/lib/ai/chat-pipeline";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import {
  logAiInteraction,
  updateAiInteractionOutcome,
} from "@/src/lib/ai/interaction-log";

const originalAiModel = process.env.AI_MODEL;
type SuccessfulPipeline = Extract<ChatPipelineResult, { ok: true }>;

const extractedIntent: ExtractedIntent = {
  intent: "create_order",
  confidence: 0.93,
  raw_text: "anh Hùng mua 20 bao xi măng 80k",
  normalized_text: "anh hùng mua 20 bao xi măng 80k",
  language: "vi",
  entities: {
    customer_name: "anh Hùng",
    supplier_name: null,
    product_name: "xi măng",
    product_management: null,
    customer_management: null,
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
  next_stage_hint: "resolve_entities",
};

const validatedIntent: ValidatedIntent = {
  intent: "create_order",
  kind: "writable",
  raw_text: extractedIntent.raw_text,
  customer: null,
  supplier: null,
  items: [],
  effective_amount: null,
  effective_paid: null,
  payment_status: null,
  paid_amount: null,
  issues: [],
  ready_for_preview: true,
  blocking_count: 0,
  warning_count: 0,
};

function successfulPipeline(
  kind: ValidatedIntent["kind"],
  intent: ExtractedIntent["intent"],
): SuccessfulPipeline {
  return {
    ok: true,
    extracted: {
      ...extractedIntent,
      intent,
    },
    validated: {
      ...validatedIntent,
      kind,
      intent,
    },
  };
}

describe("logAiInteraction", () => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert }));
  const supabase = {
    from,
  } as unknown as Parameters<typeof logAiInteraction>[0]["supabase"];

  beforeEach(() => {
    insert.mockReset();
    from.mockClear();
    insert.mockResolvedValue({ error: null });
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    if (originalAiModel === undefined) {
      delete process.env.AI_MODEL;
    } else {
      process.env.AI_MODEL = originalAiModel;
    }
    vi.restoreAllMocks();
  });

  it("logs a writable pipeline as proposed with the full AI payload", async () => {
    const pipeline = successfulPipeline("writable", "create_order");

    const turnId = await logAiInteraction({
      supabase,
      ownerId: "owner-a",
      rawText: extractedIntent.raw_text,
      pipeline,
      latencyMs: 125,
    });

    expect(turnId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(from).toHaveBeenCalledWith("ai_interactions");
    expect(insert).toHaveBeenCalledWith({
      turn_id: turnId,
      owner_id: "owner-a",
      raw_text: extractedIntent.raw_text,
      intent: "create_order",
      confidence: 0.93,
      extracted: pipeline.extracted,
      validated: pipeline.validated,
      model_version: "gpt-4.1-mini",
      latency_ms: 125,
      outcome: "proposed",
      error_stage: null,
    });
  });

  it.each([
    ["query", "query_debt", "answered"],
    ["none", "small_talk", "none"],
    ["none", "unknown", "none"],
    ["none", "manage_product", "proposed"],
    ["edit", "edit_order", "proposed"],
    ["undo", "undo", "proposed"],
  ] as const)(
    "maps kind=%s intent=%s to outcome=%s",
    async (kind, intent, expectedOutcome) => {
      await logAiInteraction({
        supabase,
        ownerId: "owner-a",
        rawText: "test",
        pipeline: successfulPipeline(kind, intent),
        latencyMs: 20,
      });

      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: expectedOutcome }),
      );
    },
  );

  it("logs a failed pipeline with its error stage and null AI payloads", async () => {
    process.env.AI_MODEL = "test-model";
    const pipeline: ChatPipelineResult = {
      ok: false,
      stage: "extract",
      code: "extract_failed",
      message: "failed",
    };

    await logAiInteraction({
      supabase,
      ownerId: "owner-a",
      rawText: "???",
      pipeline,
      latencyMs: 30,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: null,
        confidence: null,
        extracted: null,
        validated: null,
        model_version: "test-model",
        outcome: "error",
        error_stage: "extract",
      }),
    );
  });

  it("warns and still returns turnId when Supabase returns an insert error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    insert.mockResolvedValue({
      error: { code: "42501", message: "RLS denied" },
    });

    const turnId = await logAiInteraction({
      supabase,
      ownerId: "owner-a",
      rawText: "test",
      pipeline: successfulPipeline("writable", "create_order"),
      latencyMs: 10,
    });

    expect(turnId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(warnSpy).toHaveBeenCalledWith("Failed to log AI interaction", {
      code: "42501",
      message: "RLS denied",
    });
  });

  it("warns and still returns turnId when the insert throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const insertError = new Error("network unavailable");
    insert.mockRejectedValue(insertError);

    const turnId = await logAiInteraction({
      supabase,
      ownerId: "owner-a",
      rawText: "test",
      pipeline: successfulPipeline("writable", "create_order"),
      latencyMs: 10,
    });

    expect(turnId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to log AI interaction",
      insertError,
    );
  });
});

describe("updateAiInteractionOutcome", () => {
  const update = vi.fn();
  const eq = vi.fn();
  const builder = { update, eq };
  const from = vi.fn(() => builder);
  const supabase = {
    from,
  } as unknown as Parameters<typeof updateAiInteractionOutcome>[0]["supabase"];

  beforeEach(() => {
    update.mockReset();
    eq.mockReset();
    from.mockClear();
    update.mockReturnValue(builder);
    eq.mockReturnValueOnce(builder).mockResolvedValueOnce({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates outcome with owner and turn scopes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T04:30:00.000Z"));

    await updateAiInteractionOutcome({
      supabase,
      ownerId: "owner-a",
      aiTurnId: "turn-a",
      outcome: "committed",
    });

    expect(from).toHaveBeenCalledWith("ai_interactions");
    expect(update).toHaveBeenCalledWith({
      outcome: "committed",
      outcome_at: "2026-06-12T04:30:00.000Z",
    });
    expect(eq).toHaveBeenNthCalledWith(1, "owner_id", "owner-a");
    expect(eq).toHaveBeenNthCalledWith(2, "turn_id", "turn-a");
  });

  it("skips the update when aiTurnId is missing", async () => {
    await updateAiInteractionOutcome({
      supabase,
      ownerId: "owner-a",
      aiTurnId: null,
      outcome: "dismissed",
    });

    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("warns without throwing when Supabase returns an update error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    eq.mockReset();
    eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      error: { code: "42501", message: "RLS denied" },
    });

    await expect(
      updateAiInteractionOutcome({
        supabase,
        ownerId: "owner-a",
        aiTurnId: "turn-a",
        outcome: "undone",
      }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to update AI interaction outcome",
      { code: "42501", message: "RLS denied" },
    );
  });

  it("warns without throwing when the update throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const updateError = new Error("network unavailable");
    update.mockImplementationOnce(() => {
      throw updateError;
    });

    await expect(
      updateAiInteractionOutcome({
        supabase,
        ownerId: "owner-a",
        aiTurnId: "turn-a",
        outcome: "dismissed",
      }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to update AI interaction outcome",
      updateError,
    );
  });
});
