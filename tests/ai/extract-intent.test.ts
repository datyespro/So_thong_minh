import { describe, expect, it, vi } from "vitest";
import {
  extractIntent,
  IntentExtractionError,
} from "@/src/lib/ai/extract-intent";

const validOutput = {
  intent: "create_order",
  confidence: 0.92,
  raw_text: "Bán cho cô Lan 10 bao xi măng 85k, nợ",
  normalized_text: "bán cho cô Lan 10 bao xi măng 85000, nợ",
  language: "vi",
  entities: {
    customer_name: "cô Lan",
    supplier_name: null,
    product_name: "xi măng",
    product_management: null,
    customer_management: null,
    items: [
      {
        raw: "10 bao xi măng 85k",
        product_name: "xi măng",
        quantity: 10,
        unit: "bao",
        unit_price: 85000,
        line_total: null,
        confidence: 0.9,
      },
    ],
    amount: null,
    paid_amount: null,
    payment_status: "debt",
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
  needs_confirmation: true,
  next_stage_hint: "resolve_entities",
};

describe("extractIntent", () => {
  it("throws EMPTY_INPUT without calling AI for empty input", async () => {
    const generateStructuredIntent = vi.fn();

    await expect(
      extractIntent(
        { rawText: "   ", ownerId: "owner-1" },
        { generateStructuredIntent },
      ),
    ).rejects.toMatchObject({ code: "EMPTY_INPUT" });

    expect(generateStructuredIntent).not.toHaveBeenCalled();
  });

  it("throws INPUT_TOO_LONG without calling AI for long input", async () => {
    const generateStructuredIntent = vi.fn();

    await expect(
      extractIntent(
        { rawText: "a".repeat(1001), ownerId: "owner-1" },
        { generateStructuredIntent },
      ),
    ).rejects.toMatchObject({ code: "INPUT_TOO_LONG" });

    expect(generateStructuredIntent).not.toHaveBeenCalled();
  });

  it("returns parsed structured output for mocked valid AI output", async () => {
    const generateStructuredIntent = vi.fn().mockResolvedValue(validOutput);

    const extracted = await extractIntent(
      { rawText: "Bán cho cô Lan 10 bao xi măng 85k, nợ", ownerId: "owner-1" },
      { generateStructuredIntent },
    );

    expect(extracted.intent).toBe("create_order");
    expect(extracted.entities.items[0].unit_price).toBe(85000);
    expect(typeof extracted).toBe("object");
  });

  it("converts invalid AI output to INTENT_EXTRACTION_FAILED", async () => {
    const generateStructuredIntent = vi
      .fn()
      .mockResolvedValue({ ...validOutput, confidence: 1.5 });

    await expect(
      extractIntent(
        { rawText: "Bán cho cô Lan", ownerId: "owner-1" },
        { generateStructuredIntent },
      ),
    ).rejects.toMatchObject({ code: "INTENT_EXTRACTION_FAILED" });
  });

  it("passes trimmed raw text to the prompt", async () => {
    const generateStructuredIntent = vi.fn().mockResolvedValue(validOutput);

    await extractIntent(
      {
        rawText: "  Cô Lan trả 500k  ",
        ownerId: "owner-1",
        todayISO: "2026-05-28",
      },
      { generateStructuredIntent },
    );

    const prompt = generateStructuredIntent.mock.calls[0][0].prompt as string;

    expect(prompt).toContain("CÂU CẦN PHÂN TÍCH:\nCô Lan trả 500k");
    expect(prompt).toContain("todayISO là 2026-05-28");
  });

  it("preserves typed AI_CONFIG_MISSING errors", async () => {
    const generateStructuredIntent = vi.fn().mockRejectedValue(
      new IntentExtractionError("AI_CONFIG_MISSING"),
    );

    await expect(
      extractIntent(
        { rawText: "Còn bao nhiêu xi măng?", ownerId: "owner-1" },
        { generateStructuredIntent },
      ),
    ).rejects.toMatchObject({ code: "AI_CONFIG_MISSING" });
  });
});
