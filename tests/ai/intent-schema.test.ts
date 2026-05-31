import { describe, expect, it } from "vitest";
import {
  ExtractedIntentSchema,
  IntentNameSchema,
  type ExtractedIntent,
} from "@/src/lib/ai/intent-schema";

function baseIntent(
  overrides: Partial<ExtractedIntent> = {},
): ExtractedIntent {
  return {
    intent: "create_order",
    confidence: 0.92,
    raw_text: "Bán cho cô Lan 10 bao xi măng 85k, nợ",
    normalized_text: "bán cho cô Lan 10 bao xi măng 85000, nợ",
    language: "vi",
    entities: {
      customer_name: "cô Lan",
      supplier_name: null,
      product_name: "xi măng",
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
    ...overrides,
  };
}

describe("IntentNameSchema", () => {
  it("contains every required intent", () => {
    expect(IntentNameSchema.options).toEqual([
      "create_order",
      "record_payment",
      "create_purchase",
      "query_debt",
      "query_inventory",
      "query_sales",
      "edit_order",
      "undo",
      "small_talk",
      "unknown",
    ]);
  });
});

describe("ExtractedIntentSchema", () => {
  it("accepts a valid create_order output", () => {
    expect(ExtractedIntentSchema.parse(baseIntent()).intent).toBe(
      "create_order",
    );
  });

  it("accepts a valid record_payment output", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "record_payment",
        raw_text: "Cô Lan trả 500k",
        normalized_text: "cô Lan trả 500000",
        entities: {
          ...baseIntent().entities,
          product_name: null,
          items: [],
          amount: 500000,
          payment_status: "paid",
        },
      }),
    );

    expect(parsed.entities.amount).toBe(500000);
  });

  it("accepts a valid query_inventory output", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        intent: "query_inventory",
        raw_text: "Còn bao nhiêu xi măng?",
        normalized_text: "còn bao nhiêu xi măng?",
        entities: {
          ...baseIntent().entities,
          customer_name: null,
          items: [],
          amount: null,
          payment_status: "unknown",
        },
        needs_confirmation: false,
      }),
    );

    expect(parsed.intent).toBe("query_inventory");
  });

  it("rejects confidence below 0", () => {
    expect(() =>
      ExtractedIntentSchema.parse(baseIntent({ confidence: -0.1 })),
    ).toThrow();
  });

  it("rejects confidence above 1", () => {
    expect(() =>
      ExtractedIntentSchema.parse(baseIntent({ confidence: 1.5 })),
    ).toThrow();
  });

  it("rejects invalid intent", () => {
    expect(() =>
      ExtractedIntentSchema.parse({
        ...baseIntent(),
        intent: "delete_everything",
      }),
    ).toThrow();
  });

  it("allows item quantity to be null", () => {
    const parsed = ExtractedIntentSchema.parse(
      baseIntent({
        entities: {
          ...baseIntent().entities,
          items: [
            {
              ...baseIntent().entities.items[0],
              quantity: null,
            },
          ],
        },
      }),
    );

    expect(parsed.entities.items[0].quantity).toBeNull();
  });

  it("defaults missing_info to an empty array", () => {
    const withoutMissingInfo = baseIntent() as Partial<ExtractedIntent>;
    delete withoutMissingInfo.missing_info;
    const parsed = ExtractedIntentSchema.parse(withoutMissingInfo);

    expect(parsed.missing_info).toEqual([]);
  });
});
