import { describe, expect, it } from "vitest";
import {
  ResolvedEntitySchema,
  ResolvedIntentSchema,
  type ResolvedIntent,
} from "@/src/lib/ai/resolve-schema";

function baseResolvedIntent(
  overrides: Partial<ResolvedIntent> = {},
): ResolvedIntent {
  const base: ResolvedIntent = {
    intent: "create_order",
    raw_text: "Ban cho co Lan 2 bao xi mang",
    customer: {
      raw: "co Lan",
      entity_type: "customer",
      status: "resolved",
      resolved_id: "customer-lan",
      resolved_name: "C\u00f4 Lan",
      confidence: 1,
      candidates: [
        {
          id: "customer-lan",
          name: "C\u00f4 Lan",
          score: 1,
          matched_on: "name_exact",
          matched_value: "C\u00f4 Lan",
        },
      ],
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
        raw: "2 bao xi mang",
        product_name: "xi mang",
        quantity: 2,
        unit: "bao",
        unit_price: null,
        line_total: null,
        confidence: 0.9,
        resolution: {
          raw: "xi mang",
          entity_type: "product",
          status: "resolved",
          resolved_id: "product-xi-mang",
          resolved_name: "Xi m\u0103ng",
          confidence: 0.95,
          candidates: [
            {
              id: "product-xi-mang",
              name: "Xi m\u0103ng",
              score: 0.95,
              matched_on: "alias_exact",
              matched_value: "xi mang",
            },
          ],
        },
      },
    ],
    overall_status: "all_resolved",
    needs_confirmation: false,
  };

  return {
    ...base,
    ...overrides,
  };
}

describe("ResolvedEntitySchema", () => {
  it("accepts raw null for an entity not present in intent", () => {
    expect(
      ResolvedEntitySchema.parse({
        raw: null,
        entity_type: "supplier",
        status: "not_found",
        resolved_id: null,
        resolved_name: null,
        confidence: 0,
        candidates: [],
      }).raw,
    ).toBeNull();
  });

  it("rejects confidence outside 0..1", () => {
    expect(() =>
      ResolvedEntitySchema.parse({
        raw: "co Lan",
        entity_type: "customer",
        status: "resolved",
        resolved_id: "customer-lan",
        resolved_name: "C\u00f4 Lan",
        confidence: 1.2,
        candidates: [],
      }),
    ).toThrow();
  });
});

describe("ResolvedIntentSchema", () => {
  it("accepts a valid resolved intent", () => {
    const parsed = ResolvedIntentSchema.parse(baseResolvedIntent());

    expect(parsed.intent).toBe("create_order");
    expect(parsed.items[0].resolution.entity_type).toBe("product");
  });

  it("rejects invalid entity status", () => {
    expect(() =>
      ResolvedIntentSchema.parse({
        ...baseResolvedIntent(),
        customer: {
          ...baseResolvedIntent().customer,
          status: "maybe",
        },
      }),
    ).toThrow();
  });

  it("rejects more than three candidates", () => {
    const candidate = {
      id: "candidate",
      name: "Candidate",
      score: 0.5,
      matched_on: "fuzzy",
      matched_value: "candidate",
    };

    expect(() =>
      ResolvedIntentSchema.parse({
        ...baseResolvedIntent(),
        customer: {
          ...baseResolvedIntent().customer,
          status: "ambiguous",
          candidates: [
            { ...candidate, id: "1" },
            { ...candidate, id: "2" },
            { ...candidate, id: "3" },
            { ...candidate, id: "4" },
          ],
        },
      }),
    ).toThrow();
  });
});
