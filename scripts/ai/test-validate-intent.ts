import type { ResolvedEntity, ResolvedIntent } from "@/src/lib/ai/resolve-schema";
import {
  validateResolvedIntent,
  type ValidationMasters,
} from "@/src/lib/ai/validator";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";

const customerLan: ResolvedEntity = {
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

const supplierA: ResolvedEntity = {
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
    raw: "5 bao xi mang",
    product_name: "xi mang",
    quantity: 5,
    unit: "bao",
    unit_price: 85000,
    line_total: null,
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
    raw_text: "Ban cho co Lan 5 bao xi mang",
    amount: null,
    payment_status: "paid",
    payment_method: "cash",
    customer: customerLan,
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

function hasIssue(validated: ValidatedIntent, code: string) {
  return (
    validated.issues.some((issue) => issue.code === code) ||
    validated.items.some((item) =>
      item.issues.some((issue) => issue.code === code),
    )
  );
}

function runCase(
  name: string,
  resolved: ResolvedIntent,
  assert: (validated: ValidatedIntent) => boolean,
) {
  const validated = validateResolvedIntent(resolved, masters);
  const passed = assert(validated);

  console.log(
    JSON.stringify(
      {
        case: name,
        pass: passed,
        kind: validated.kind,
        ready_for_preview: validated.ready_for_preview,
        blocking_count: validated.blocking_count,
        warning_count: validated.warning_count,
        effective_amount: validated.effective_amount,
        item_totals: validated.items.map((item) => ({
          product: item.resolution.resolved_name,
          effective_unit_price: item.effective_unit_price,
          line_total: item.line_total,
          issues: item.issues.map((issue) => issue.code),
        })),
        issues: validated.issues.map((issue) => issue.code),
        messages: [
          ...validated.issues.map((issue) => issue.message),
          ...validated.items.flatMap((item) =>
            item.issues.map((issue) => issue.message),
          ),
        ],
      },
      null,
      2,
    ),
  );

  return passed;
}

const results = [
  runCase("order_ready", baseResolved(), (validated) => {
    return (
      validated.kind === "writable" &&
      validated.ready_for_preview &&
      validated.blocking_count === 0 &&
      validated.items[0]?.line_total === 425000
    );
  }),
  runCase(
    "price_autofill",
    baseResolved({
      items: [productItem({ unit_price: null })],
    }),
    (validated) =>
      hasIssue(validated, "price_autofilled") &&
      validated.items[0]?.effective_unit_price === 85000 &&
      validated.items[0]?.line_total === 425000 &&
      validated.ready_for_preview,
  ),
  runCase(
    "missing_price_block",
    baseResolved({
      items: [
        productItem({
          product_name: "gach chua gia",
          unit: "vi\u00ean",
          unit_price: null,
          resolution: {
            resolved_id: "product-no-price",
            resolved_name: "G\u1ea1ch ch\u01b0a gi\u00e1",
          },
        }),
      ],
    }),
    (validated) =>
      hasIssue(validated, "missing_price") && !validated.ready_for_preview,
  ),
  runCase(
    "missing_customer_block",
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
    (validated) =>
      hasIssue(validated, "missing_customer") && !validated.ready_for_preview,
  ),
  runCase(
    "invalid_quantity_block",
    baseResolved({
      items: [productItem({ quantity: 0 })],
    }),
    (validated) =>
      hasIssue(validated, "invalid_quantity") && !validated.ready_for_preview,
  ),
  runCase(
    "unit_mismatch_warn",
    baseResolved({
      items: [productItem({ unit: "th\u00f9ng" })],
    }),
    (validated) =>
      hasIssue(validated, "unit_mismatch") && validated.ready_for_preview,
  ),
  runCase(
    "payment_ready",
    baseResolved({
      intent: "record_payment",
      amount: 100000,
      items: [],
    }),
    (validated) =>
      validated.kind === "writable" &&
      validated.ready_for_preview &&
      validated.effective_amount === 100000,
  ),
  runCase(
    "missing_amount_block",
    baseResolved({
      intent: "record_payment",
      amount: null,
      items: [],
    }),
    (validated) =>
      hasIssue(validated, "missing_amount") && !validated.ready_for_preview,
  ),
  runCase(
    "overpayment_warn",
    baseResolved({
      intent: "record_payment",
      amount: 500000,
      items: [],
    }),
    (validated) =>
      hasIssue(validated, "overpayment") && validated.ready_for_preview,
  ),
  runCase(
    "purchase_missing_supplier_block",
    baseResolved({
      intent: "create_purchase",
      customer: null,
      supplier: missingSupplier,
      items: [productItem()],
    }),
    (validated) =>
      hasIssue(validated, "missing_supplier") &&
      !validated.ready_for_preview,
  ),
  runCase(
    "purchase_cost_autofill",
    baseResolved({
      intent: "create_purchase",
      customer: null,
      supplier: supplierA,
      items: [productItem({ unit_price: null })],
    }),
    (validated) =>
      hasIssue(validated, "price_autofilled") &&
      validated.items[0]?.effective_unit_price === 78000,
  ),
  runCase("query_routing", baseResolved({ intent: "query_debt" }), (validated) => {
    return (
      validated.kind === "query" &&
      validated.issues.length === 0 &&
      !validated.ready_for_preview
    );
  }),
  runCase("edit_routing", baseResolved({ intent: "edit_order" }), (validated) => {
    return validated.kind === "edit" && validated.issues.length === 0;
  }),
  runCase("undo_routing", baseResolved({ intent: "undo" }), (validated) => {
    return validated.kind === "undo" && validated.issues.length === 0;
  }),
  runCase("none_routing", baseResolved({ intent: "small_talk" }), (validated) => {
    return validated.kind === "none" && validated.issues.length === 0;
  }),
];

if (results.some((passed) => !passed)) {
  process.exitCode = 1;
}
