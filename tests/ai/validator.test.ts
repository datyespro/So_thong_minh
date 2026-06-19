import { describe, expect, it } from "vitest";
import type { ResolvedEntity, ResolvedIntent } from "@/src/lib/ai/resolve-schema";
import {
  validateResolvedIntent,
  type ValidationMasters,
} from "@/src/lib/ai/validator";
import type { ValidationCode } from "@/src/lib/ai/validate-schema";

const customerResolved: ResolvedEntity = {
  raw: "c\u00f4 Lan",
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
};

const supplierResolved: ResolvedEntity = {
  raw: "ncc a",
  entity_type: "supplier",
  status: "resolved",
  resolved_id: "supplier-a",
  resolved_name: "Nh\u00e0 cung c\u1ea5p A",
  confidence: 1,
  candidates: [
    {
      id: "supplier-a",
      name: "Nh\u00e0 cung c\u1ea5p A",
      score: 1,
      matched_on: "alias_exact",
      matched_value: "ncc a",
    },
  ],
};

const missingSupplier: ResolvedEntity = {
  raw: null,
  entity_type: "supplier",
  status: "not_found",
  resolved_id: null,
  resolved_name: null,
  confidence: 0,
  candidates: [],
};

const masters: ValidationMasters = {
  products: new Map([
    [
      "product-xi-mang",
      {
        name: "Xi m\u0103ng",
        unit: "bao",
        sell_price: 85000,
        cost_price: 78000,
      },
    ],
    [
      "product-no-price",
      {
        name: "G\u1ea1ch ch\u01b0a gi\u00e1",
        unit: "vi\u00ean",
        sell_price: null,
        cost_price: null,
      },
    ],
  ]),
  debts: new Map([
    [
      "customer-lan",
      {
        debt_total: 200000,
      },
    ],
  ]),
};

type ProductItemOverrides = Omit<
  Partial<ResolvedIntent["items"][number]>,
  "resolution"
> & {
  resolution?: Partial<ResolvedIntent["items"][number]["resolution"]>;
};

function productItem(overrides: ProductItemOverrides = {}) {
  const base: ResolvedIntent["items"][number] = {
    raw: "10 bao xi mang",
    product_name: "xi mang",
    quantity: 10,
    unit: "bao",
    unit_price: 85000,
    line_total: null,
    confidence: 0.95,
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
  };

  return {
    ...base,
    ...overrides,
    resolution: {
      ...base.resolution,
      ...overrides.resolution,
    },
  };
}

function baseResolved(
  overrides: Partial<ResolvedIntent> = {},
): ResolvedIntent {
  const base: ResolvedIntent = {
    intent: "create_order",
    raw_text: "Ban cho co Lan 10 bao xi mang",
    amount: null,
    paid_amount: null,
    payment_status: "paid",
    payment_method: "cash",
    customer: customerResolved,
    supplier: missingSupplier,
    items: [productItem()],
    overall_status: "all_resolved",
    needs_confirmation: false,
  };

  return {
    ...base,
    ...overrides,
  };
}

function issueCodes(result: ReturnType<typeof validateResolvedIntent>) {
  return [
    ...result.issues.map((issue) => issue.code),
    ...result.items.flatMap((item) => item.issues.map((issue) => issue.code)),
  ];
}

function hasIssue(
  result: ReturnType<typeof validateResolvedIntent>,
  code: ValidationCode,
) {
  return issueCodes(result).includes(code);
}

describe("validateResolvedIntent create_order", () => {
  it("marks a complete order ready for preview and computes line total", () => {
    const result = validateResolvedIntent(baseResolved(), masters);

    expect(result.kind).toBe("writable");
    expect(result.ready_for_preview).toBe(true);
    expect(result.blocking_count).toBe(0);
    expect(result.items[0].line_total).toBe(850000);
  });

  it("auto-fills quantity=1 when quantity is null but amount is provided for a single item", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 2000000,
        payment_status: "debt",
        items: [productItem({ quantity: null, unit_price: null })],
      }),
      masters,
    );

    expect(hasIssue(result, "invalid_quantity")).toBe(false);
    expect(result.items[0].effective_quantity).toBe(1);
    expect(result.items[0].effective_unit_price).toBe(2000000);
    expect(result.items[0].line_total).toBe(2000000);
    expect(hasIssue(result, "price_from_total")).toBe(true);
    expect(result.blocking_count).toBe(0);
  });

  it("still blocks invalid_quantity when quantity is null and no amount", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: null,
        payment_status: "debt",
        items: [productItem({ quantity: null, unit_price: null })],
      }),
      masters,
    );

    expect(hasIssue(result, "invalid_quantity")).toBe(true);
    expect(result.blocking_count).toBeGreaterThan(0);
  });

  it("still blocks invalid_quantity when quantity is null with amount but multiple items", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 5000000,
        payment_status: "debt",
        items: [
          productItem({ quantity: null, unit_price: null }),
          productItem({ quantity: null, unit_price: null, raw: "cát", product_name: "cát" }),
        ],
      }),
      masters,
    );

    expect(hasIssue(result, "invalid_quantity")).toBe(true);
  });

  it("autofills missing sell price from product master", () => {
    const result = validateResolvedIntent(
      baseResolved({
        items: [productItem({ quantity: 5, unit_price: null })],
      }),
      masters,
    );

    expect(hasIssue(result, "price_autofilled")).toBe(true);
    expect(result.items[0].effective_unit_price).toBe(85000);
    expect(result.items[0].line_total).toBe(425000);
    expect(result.ready_for_preview).toBe(true);
  });

  it("blocks when price is missing and master has no sell price", () => {
    const result = validateResolvedIntent(
      baseResolved({
        items: [
          productItem({
            unit_price: null,
            resolution: {
              resolved_id: "product-no-price",
              resolved_name: "G\u1ea1ch ch\u01b0a gi\u00e1",
            },
          }),
        ],
      }),
      masters,
    );

    expect(hasIssue(result, "missing_price")).toBe(true);
    expect(result.ready_for_preview).toBe(false);
  });

  it("blocks when customer is missing", () => {
    const result = validateResolvedIntent(
      baseResolved({
        customer: {
          raw: null,
          entity_type: "customer",
          status: "not_found",
          resolved_id: null,
          resolved_name: null,
          confidence: 0,
          candidates: [],
        },
      }),
      masters,
    );

    expect(hasIssue(result, "missing_customer")).toBe(true);
    expect(result.ready_for_preview).toBe(false);
  });

  it("blocks when customer raw text is unresolved", () => {
    const result = validateResolvedIntent(
      baseResolved({
        customer: {
          raw: "c\u00f4 Xyz",
          entity_type: "customer",
          status: "not_found",
          resolved_id: null,
          resolved_name: null,
          confidence: 0,
          candidates: [],
        },
      }),
      masters,
    );

    expect(hasIssue(result, "customer_unresolved")).toBe(true);
    expect(result.issues[0].message).toContain("c\u00f4 Xyz");
  });

  it("blocks invalid quantity", () => {
    const result = validateResolvedIntent(
      baseResolved({
        items: [productItem({ quantity: 0 })],
      }),
      masters,
    );

    expect(hasIssue(result, "invalid_quantity")).toBe(true);
    expect(result.ready_for_preview).toBe(false);
  });

  it("warns but does not block on unit mismatch", () => {
    const result = validateResolvedIntent(
      baseResolved({
        items: [productItem({ unit: "th\u00f9ng" })],
      }),
      masters,
    );

    expect(hasIssue(result, "unit_mismatch")).toBe(true);
    expect(result.ready_for_preview).toBe(true);
  });

  it("warns when payment status is unknown", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "unknown",
      }),
      masters,
    );

    expect(hasIssue(result, "payment_status_unknown")).toBe(true);
    expect(result.ready_for_preview).toBe(true);
  });

  it("blocks partial payment above the order total", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "partial",
        paid_amount: 900000,
      }),
      masters,
    );

    expect(hasIssue(result, "paid_exceeds_total")).toBe(true);
    expect(result.effective_paid).toBeNull();
    expect(result.ready_for_preview).toBe(false);
  });

  it("computes an effective partial payment", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "partial",
        paid_amount: 500000,
      }),
      masters,
    );

    expect(hasIssue(result, "paid_exceeds_total")).toBe(false);
    expect(result.effective_paid).toBe(500000);
    expect(result.effective_amount).toBeNull();
    expect(result.payment_status).toBe("partial");
    expect(result.paid_amount).toBe(500000);
    expect(result.ready_for_preview).toBe(true);
  });

  it("uses the order total as effective paid when payment is full", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "paid",
        paid_amount: null,
        items: [productItem({ quantity: 5, unit_price: 80000 })],
      }),
      masters,
    );

    expect(result.effective_paid).toBe(400000);
    expect(result.effective_amount).toBeNull();
  });

  it("warns when partial payment has no amount", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "partial",
        paid_amount: null,
      }),
      masters,
    );

    expect(hasIssue(result, "payment_status_unknown")).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "payment_status_unknown",
        severity: "warning",
        message: "Chưa rõ trả trước bao nhiêu ạ.",
        field_path: "paid_amount",
      }),
    );
    expect(result.effective_paid).toBeNull();
    expect(result.ready_for_preview).toBe(true);
  });

  it("keeps a debt order at zero effective paid", () => {
    const result = validateResolvedIntent(
      baseResolved({
        payment_status: "debt",
        paid_amount: null,
      }),
      masters,
    );

    expect(hasIssue(result, "payment_status_unknown")).toBe(false);
    expect(result.effective_paid).toBe(0);
    expect(result.effective_amount).toBeNull();
    expect(result.ready_for_preview).toBe(true);
  });

  it("infers an integer unit price from a one-item order total", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 1600000,
        payment_status: "unknown",
        items: [productItem({ quantity: 20, unit_price: null })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBe(80000);
    expect(result.items[0].line_total).toBe(1600000);
    expect(hasIssue(result, "price_from_total")).toBe(true);
    expect(hasIssue(result, "price_autofilled")).toBe(false);
    expect(result.ready_for_preview).toBe(true);
  });

  it("infers an integer VND price for a decimal quantity", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 1600000,
        payment_status: "unknown",
        items: [productItem({ quantity: 0.5, unit: "khối", unit_price: null })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBe(3200000);
    expect(result.items[0].line_total).toBe(1600000);
    expect(hasIssue(result, "price_from_total")).toBe(true);
  });

  it("blocks a total that would produce a fractional VND unit price", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 100000,
        payment_status: "unknown",
        items: [productItem({ quantity: 5.5, unit: null, unit_price: null })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBeNull();
    expect(result.items[0].line_total).toBeNull();
    expect(hasIssue(result, "total_not_divisible")).toBe(true);
    expect(hasIssue(result, "price_autofilled")).toBe(false);
    expect(result.items[0].issues[0].message).toContain("5,5 đơn vị");
    expect(result.ready_for_preview).toBe(false);
  });

  it.each(["paid", "partial"] as const)(
    "keeps master-price autofill when payment status is %s",
    (paymentStatus) => {
      const result = validateResolvedIntent(
        baseResolved({
          amount: 1600000,
          payment_status: paymentStatus,
          items: [productItem({ quantity: 20, unit_price: null })],
        }),
        masters,
      );

      expect(result.items[0].effective_unit_price).toBe(85000);
      expect(hasIssue(result, "price_autofilled")).toBe(true);
      expect(hasIssue(result, "price_from_total")).toBe(false);
      expect(hasIssue(result, "total_not_divisible")).toBe(false);
    },
  );

  it("warns without splitting a total across multiple items", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 1600000,
        payment_status: "unknown",
        items: [
          productItem({ quantity: 10, unit_price: null }),
          productItem({ quantity: 5, unit_price: null }),
        ],
      }),
      masters,
    );

    expect(hasIssue(result, "total_with_multiple_items")).toBe(true);
    expect(hasIssue(result, "price_autofilled")).toBe(true);
    expect(result.items.map((item) => item.effective_unit_price)).toEqual([
      85000, 85000,
    ]);
  });

  it("does not warn about a multi-item total when payment status is paid", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 1600000,
        payment_status: "paid",
        items: [
          productItem({ quantity: 10, unit_price: null }),
          productItem({ quantity: 5, unit_price: null }),
        ],
      }),
      masters,
    );

    expect(hasIssue(result, "total_with_multiple_items")).toBe(false);
    expect(hasIssue(result, "price_autofilled")).toBe(true);
  });

  it("keeps an explicit unit price ahead of the stated total", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: 1600000,
        payment_status: "unknown",
        items: [productItem({ quantity: 20, unit_price: 90000 })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBe(90000);
    expect(result.items[0].line_total).toBe(1800000);
    expect(hasIssue(result, "price_from_total")).toBe(false);
    expect(hasIssue(result, "total_not_divisible")).toBe(false);
    expect(hasIssue(result, "price_autofilled")).toBe(false);
  });

  it("keeps the existing master-price flow when amount is null", () => {
    const result = validateResolvedIntent(
      baseResolved({
        amount: null,
        payment_status: "unknown",
        items: [productItem({ quantity: 5, unit_price: null })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBe(85000);
    expect(result.items[0].line_total).toBe(425000);
    expect(hasIssue(result, "price_autofilled")).toBe(true);
    expect(hasIssue(result, "price_from_total")).toBe(false);
    expect(hasIssue(result, "total_not_divisible")).toBe(false);
  });
});

describe("validateResolvedIntent record_payment", () => {
  it("marks a complete payment ready for preview", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "record_payment",
        amount: 500000,
        paid_amount: null,
        payment_status: "unknown",
        items: [productItem()],
      }),
      masters,
    );

    expect(result.kind).toBe("writable");
    expect(result.items).toEqual([]);
    expect(result.ready_for_preview).toBe(true);
    expect(result.effective_amount).toBe(500000);
    expect(result.payment_status).toBe("unknown");
    expect(result.paid_amount).toBeNull();
  });

  it("blocks missing amount", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "record_payment",
        amount: null,
        items: [],
      }),
      masters,
    );

    expect(hasIssue(result, "missing_amount")).toBe(true);
    expect(result.ready_for_preview).toBe(false);
  });

  it("blocks invalid amount", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "record_payment",
        amount: 0,
        items: [],
      }),
      masters,
    );

    expect(hasIssue(result, "invalid_amount")).toBe(true);
  });

  it("warns on overpayment", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "record_payment",
        amount: 500000,
        items: [],
      }),
      masters,
    );

    expect(hasIssue(result, "overpayment")).toBe(true);
    expect(result.ready_for_preview).toBe(true);
  });

  it("warns when payment method is unknown", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "record_payment",
        amount: 100000,
        payment_method: null,
        items: [],
      }),
      masters,
    );

    expect(hasIssue(result, "payment_method_unknown")).toBe(true);
  });
});

describe("validateResolvedIntent create_purchase", () => {
  it("blocks missing supplier", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "create_purchase",
        customer: null,
        supplier: missingSupplier,
      }),
      masters,
    );

    expect(hasIssue(result, "missing_supplier")).toBe(true);
    expect(result.ready_for_preview).toBe(false);
  });

  it("autofills missing cost price from product master", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "create_purchase",
        customer: null,
        supplier: supplierResolved,
        items: [productItem({ quantity: 5, unit_price: null })],
      }),
      masters,
    );

    expect(hasIssue(result, "price_autofilled")).toBe(true);
    expect(result.items[0].effective_unit_price).toBe(78000);
  });

  it("infers an integer unit cost from a one-item purchase total", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "create_purchase",
        amount: 1600000,
        payment_status: "unknown",
        customer: null,
        supplier: supplierResolved,
        items: [productItem({ quantity: 20, unit_price: null })],
      }),
      masters,
    );

    expect(result.items[0].effective_unit_price).toBe(80000);
    expect(result.items[0].line_total).toBe(1600000);
    expect(hasIssue(result, "price_from_total")).toBe(true);
    expect(hasIssue(result, "price_autofilled")).toBe(false);
    expect(result.ready_for_preview).toBe(true);
  });
});

describe("validateResolvedIntent routing", () => {
  it("does not validate query intents as writable transactions", () => {
    const result = validateResolvedIntent(
      baseResolved({
        intent: "query_debt",
        payment_status: "unknown",
      }),
      masters,
    );

    expect(result.kind).toBe("query");
    expect(result.issues).toEqual([]);
    expect(result.ready_for_preview).toBe(false);
    expect(result.payment_status).toBe("unknown");
    expect(result.paid_amount).toBeNull();
  });

  it("routes edit, undo, and small talk intents", () => {
    expect(
      validateResolvedIntent(baseResolved({ intent: "edit_order" }), masters)
        .kind,
    ).toBe("edit");
    expect(
      validateResolvedIntent(baseResolved({ intent: "undo" }), masters).kind,
    ).toBe("undo");
    expect(
      validateResolvedIntent(baseResolved({ intent: "small_talk" }), masters)
        .kind,
    ).toBe("none");
  });
});

describe("validateResolvedIntent business date", () => {
  it("passes through a non-null date and preserves the old shape without one", () => {
    const dated = validateResolvedIntent(
      baseResolved({ business_date: "2026-06-01" }),
      masters,
    );
    const undated = validateResolvedIntent(baseResolved(), masters);

    expect(dated.business_date).toBe("2026-06-01");
    expect(undated).not.toHaveProperty("business_date");
  });
});
