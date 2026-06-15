import { resolveEntities, type OwnerEntityRows } from "@/src/lib/ai/resolve-entities";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ResolvedIntent } from "@/src/lib/ai/resolve-schema";

const ownerRows: OwnerEntityRows = {
  customers: [
    {
      id: "customer-lan",
      name: "C\u00f4 Lan",
      aliases: ["co lan", "lan"],
    },
    {
      id: "customer-lanh",
      name: "C\u00f4 L\u00e0nh",
      aliases: ["co lanh", "lan"],
    },
    {
      id: "customer-hung",
      name: "Anh H\u00f9ng",
      aliases: ["hung"],
    },
  ],
  products: [
    {
      id: "product-xi-mang",
      name: "Xi m\u0103ng",
      aliases: ["xi mang", "ximang"],
    },
    {
      id: "product-xi-mang-ha-tien",
      name: "Xi m\u0103ng H\u00e0 Ti\u00ean",
      aliases: ["ha tien", "xi mang ht"],
    },
    {
      id: "product-gach-do",
      name: "G\u1ea1ch \u0111\u1ecf",
      aliases: ["gach do"],
    },
  ],
  suppliers: [
    {
      id: "supplier-a",
      name: "Nh\u00e0 cung c\u1ea5p A",
      aliases: ["ncc a"],
    },
  ],
};

function baseIntent(overrides: Partial<ExtractedIntent> = {}): ExtractedIntent {
  const base: ExtractedIntent = {
    intent: "create_order",
    confidence: 0.92,
    raw_text: "Ban cho co Lan 10 bao xi mang",
    normalized_text: "ban cho co lan 10 bao xi mang",
    language: "vi",
    entities: {
      customer_name: null,
      supplier_name: null,
      product_name: null,
      product_management: null,
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

  return {
    ...base,
    ...overrides,
    entities: {
      ...base.entities,
      ...overrides.entities,
    },
  };
}

async function runCase(
  name: string,
  intent: ExtractedIntent,
  assert: (resolved: ResolvedIntent) => boolean,
) {
  const resolved = await resolveEntities({
    intent,
    ownerId: "owner-smoke",
    entityRows: ownerRows,
  });
  const passed = assert(resolved);

  console.log(
    JSON.stringify(
      {
        case: name,
        pass: passed,
        customer: resolved.customer
          ? {
              raw: resolved.customer.raw,
              status: resolved.customer.status,
              resolved_name: resolved.customer.resolved_name,
              confidence: resolved.customer.confidence,
              candidates: resolved.customer.candidates.map((candidate) => ({
                name: candidate.name,
                score: Number(candidate.score.toFixed(3)),
                matched_on: candidate.matched_on,
              })),
            }
          : null,
        items: resolved.items.map((item) => ({
          product_name: item.product_name,
          status: item.resolution.status,
          resolved_name: item.resolution.resolved_name,
          confidence: Number(item.resolution.confidence.toFixed(3)),
          candidates: item.resolution.candidates.map((candidate) => ({
            name: candidate.name,
            score: Number(candidate.score.toFixed(3)),
            matched_on: candidate.matched_on,
          })),
        })),
        overall_status: resolved.overall_status,
      },
      null,
      2,
    ),
  );

  return passed;
}

async function main() {
  const results = await Promise.all([
    runCase(
      "name_exact",
      baseIntent({
        entities: {
          ...baseIntent().entities,
          customer_name: "c\u00f4 lan",
        },
      }),
      (resolved) =>
        resolved.customer?.status === "resolved" &&
        resolved.customer.candidates[0]?.matched_on === "name_exact",
    ),
    runCase(
      "alias_exact",
      baseIntent({
        entities: {
          ...baseIntent().entities,
          customer_name: "Hung",
        },
      }),
      (resolved) =>
        resolved.customer?.status === "resolved" &&
        resolved.customer.candidates[0]?.matched_on === "alias_exact",
    ),
    runCase(
      "ambiguous_lan",
      baseIntent({
        entities: {
          ...baseIntent().entities,
          customer_name: "lan",
        },
      }),
      (resolved) =>
        resolved.customer?.status === "ambiguous" &&
        resolved.customer.candidates.length === 2,
    ),
    runCase(
      "needs_confirmation",
      baseIntent({
        entities: {
          ...baseIntent().entities,
          product_name: "xi mang trang",
        },
      }),
      (resolved) =>
        resolved.items[0]?.resolution.status === "needs_confirmation" &&
        resolved.items[0].resolution.candidates.length > 0,
    ),
    runCase(
      "not_found",
      baseIntent({
        entities: {
          ...baseIntent().entities,
          customer_name: "Khach vang lai XYZ",
        },
      }),
      (resolved) =>
        resolved.customer?.status === "not_found" &&
        resolved.customer.candidates.length === 0,
    ),
  ]);

  if (results.some((passed) => !passed)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
