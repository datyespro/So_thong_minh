import { describe, expect, it } from "vitest";
import {
  ValidatedIntentSchema,
  ValidationIssueSchema,
  type ValidatedIntent,
} from "@/src/lib/ai/validate-schema";

function baseValidatedIntent(
  overrides: Partial<ValidatedIntent> = {},
): ValidatedIntent {
  const base: ValidatedIntent = {
    intent: "create_order",
    kind: "writable",
    raw_text: "Ban cho co Lan 5 bao xi mang",
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
        raw: "5 bao xi mang",
        product_name: "xi mang",
        quantity: 5,
        unit: "bao",
        unit_price: 85000,
        line_total: 425000,
        confidence: 0.9,
        resolution: {
          raw: "xi mang",
          entity_type: "product",
          status: "resolved",
          resolved_id: "product-xi-mang",
          resolved_name: "Xi m\u0103ng",
          confidence: 1,
          candidates: [
            {
              id: "product-xi-mang",
              name: "Xi m\u0103ng",
              score: 1,
              matched_on: "name_exact",
              matched_value: "Xi m\u0103ng",
            },
          ],
        },
        effective_quantity: 5,
        effective_unit: "bao",
        effective_unit_price: 85000,
        issues: [],
      },
    ],
    effective_amount: null,
    effective_paid: null,
    issues: [],
    ready_for_preview: true,
    blocking_count: 0,
    warning_count: 0,
  };

  return {
    ...base,
    ...overrides,
  };
}

describe("ValidationIssueSchema", () => {
  it("accepts a valid issue", () => {
    const parsed = ValidationIssueSchema.parse({
      code: "missing_customer",
      severity: "blocking",
      message: "Ch\u01b0a r\u00f5 b\u00e1n cho kh\u00e1ch n\u00e0o.",
      field_path: "customer",
      item_index: null,
    });

    expect(parsed.code).toBe("missing_customer");
  });

  it("rejects unknown issue codes", () => {
    expect(() =>
      ValidationIssueSchema.parse({
        code: "bad_code",
        severity: "blocking",
        message: "Bad",
        field_path: null,
        item_index: null,
      }),
    ).toThrow();
  });
});

describe("ValidatedIntentSchema", () => {
  it("accepts a valid writable validated intent", () => {
    const parsed = ValidatedIntentSchema.parse(baseValidatedIntent());

    expect(parsed.ready_for_preview).toBe(true);
    expect(parsed.items[0].line_total).toBe(425000);
  });

  it("accepts query routing without preview readiness", () => {
    const parsed = ValidatedIntentSchema.parse(
      baseValidatedIntent({
        intent: "query_debt",
        kind: "query",
        ready_for_preview: false,
      }),
    );

    expect(parsed.kind).toBe("query");
  });

  it("rejects invalid validation kind", () => {
    expect(() =>
      ValidatedIntentSchema.parse({
        ...baseValidatedIntent(),
        kind: "bad",
      }),
    ).toThrow();
  });
});
