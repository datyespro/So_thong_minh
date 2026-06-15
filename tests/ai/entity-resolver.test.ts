import { describe, expect, it } from "vitest";
import {
  resolveOne,
  RESOLVE_THRESHOLDS,
  type EntityRow,
} from "@/src/lib/ai/entity-resolver";
import { resolveEntities, type OwnerEntityRows } from "@/src/lib/ai/resolve-entities";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";

const customers: EntityRow[] = [
  {
    id: "customer-lan",
    name: "C\u00f4 Lan",
    aliases: ["co lan", "lan"],
  },
  {
    id: "customer-hung",
    name: "Anh H\u00f9ng",
    aliases: ["hung"],
  },
];

const products: EntityRow[] = [
  {
    id: "product-xi-mang",
    name: "Xi m\u0103ng",
    aliases: [],
  },
  {
    id: "product-xi-mang-ha-tien",
    name: "Xi m\u0103ng H\u00e0 Ti\u00ean",
    aliases: [],
  },
  {
    id: "product-thep-10",
    name: "Th\u00e9p phi 10",
    aliases: [],
  },
  {
    id: "product-gach",
    name: "G\u1ea1ch \u0111\u1ecf",
    aliases: ["gach do"],
  },
];

const ownerRows: OwnerEntityRows = {
  customers,
  products,
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
    confidence: 0.91,
    raw_text: "Ban cho co Lan 2 bao xi mang",
    normalized_text: "ban cho co lan 2 bao xi mang",
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

describe("resolveOne", () => {
  it("resolves exact normalized names", () => {
    const resolved = resolveOne("c\u00f4 lan", "customer", customers);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("customer-lan");
    expect(resolved.confidence).toBe(1);
    expect(resolved.candidates[0].matched_on).toBe("name_exact");
  });

  it("carries an optional product unit on candidates without changing matching", () => {
    const resolved = resolveOne("xi mang", "product", [
      {
        id: "product-xi-mang",
        name: "Xi m\u0103ng",
        unit: "bao",
        aliases: ["xm"],
      },
    ]);

    expect(resolved.status).toBe("resolved");
    expect(resolved.confidence).toBe(1);
    expect(resolved.candidates[0]).toMatchObject({
      id: "product-xi-mang",
      matched_on: "name_exact",
      unit: "bao",
    });
  });

  it("resolves exact normalized aliases", () => {
    const resolved = resolveOne("Hung", "customer", customers);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("customer-hung");
    expect(resolved.confidence).toBe(0.95);
    expect(resolved.candidates[0].matched_on).toBe("alias_exact");
  });

  it("returns ambiguous when the same alias belongs to multiple rows", () => {
    const resolved = resolveOne("lan", "customer", [
      {
        id: "customer-lan",
        name: "C\u00f4 Lan",
        aliases: ["lan"],
      },
      {
        id: "customer-lanh",
        name: "C\u00f4 L\u00e0nh",
        aliases: ["lan"],
      },
    ]);

    expect(resolved.status).toBe("ambiguous");
    expect(resolved.resolved_id).toBeNull();
    expect(resolved.candidates.map((candidate) => candidate.id)).toEqual([
      "customer-lan",
      "customer-lanh",
    ]);
  });

  it("auto-resolves high-confidence fuzzy matches", () => {
    const resolved = resolveOne("thep phi", "product", products);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("product-thep-10");
    expect(resolved.candidates[0].matched_on).toBe("fuzzy");
  });

  it("returns ambiguous when top fuzzy candidates are close, dropping sub-threshold ones", () => {
    const resolved = resolveOne("xi mang tien", "product", products);

    expect(resolved.status).toBe("ambiguous");
    // bug (2): "Gạch đỏ" and "Thép phi 10" score 0 here and must
    // not leak into the displayed list; only >= CONFIRM_MIN candidates survive.
    expect(resolved.candidates.map((candidate) => candidate.id)).toEqual([
      "product-xi-mang-ha-tien",
      "product-xi-mang",
    ]);
    for (const candidate of resolved.candidates) {
      expect(candidate.score).toBeGreaterThanOrEqual(
        RESOLVE_THRESHOLDS.CONFIRM_MIN,
      );
    }
  });

  it("returns needs_confirmation for medium fuzzy matches", () => {
    const resolved = resolveOne("xi mang trang", "product", products);

    expect(resolved.status).toBe("needs_confirmation");
    expect(resolved.candidates[0].id).toBe("product-xi-mang");
  });

  it("returns not_found with no candidates below the confirmation threshold", () => {
    const resolved = resolveOne("Khach vang lai XYZ", "customer", customers);

    expect(resolved.status).toBe("not_found");
    expect(resolved.raw).toBe("Khach vang lai XYZ");
    expect(resolved.candidates).toEqual([]);
  });

  it("treats missing entity text as raw null and not_found", () => {
    const resolved = resolveOne(null, "supplier", ownerRows.suppliers);

    expect(resolved).toMatchObject({
      raw: null,
      entity_type: "supplier",
      status: "not_found",
      resolved_id: null,
      candidates: [],
    });
  });
});

describe("resolveOne — TIP-004-FIX honorific stripping + candidate filter", () => {
  // seed dat@test.com: anh Hùng, anh Tuấn, chị Lan, anh Đạt (names carry an
  // honorific, no aliases) so the honorific-free fuzzy path is exercised
  // without any alias safety net.
  const honorificCustomers: EntityRow[] = [
    { id: "c-hung", name: "anh Hùng", aliases: [] },
    { id: "c-tuan", name: "anh Tuấn", aliases: [] },
    { id: "c-lan", name: "chị Lan", aliases: [] },
    { id: "c-dat", name: "anh Đạt", aliases: [] },
  ];

  it("a new name with an honorific is not_found with no junk candidates", () => {
    const resolved = resolveOne("anh Phát", "customer", honorificCustomers);

    expect(resolved.status).toBe("not_found");
    expect(resolved.candidates).toEqual([]);
  });

  it("stays not_found for any honorific prefixing the new name", () => {
    const resolved = resolveOne("chị Phát", "customer", honorificCustomers);

    expect(resolved.status).toBe("not_found");
    expect(resolved.candidates).toEqual([]);
  });

  it("the bare new name resolves to the same not_found (honorific stripped both sides)", () => {
    const resolved = resolveOne("Phát", "customer", honorificCustomers);

    expect(resolved.status).toBe("not_found");
    expect(resolved.candidates).toEqual([]);
  });

  it("an exact honorific name still resolves via name_exact", () => {
    const resolved = resolveOne("anh Hùng", "customer", honorificCustomers);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-hung");
    expect(resolved.resolved_name).toBe("anh Hùng");
    expect(resolved.candidates[0].matched_on).toBe("name_exact");
  });

  it("the bare name resolves to the honorific row without showing anyone else", () => {
    const resolved = resolveOne("Hùng", "customer", honorificCustomers);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-hung");
    expect(resolved.resolved_name).toBe("anh Hùng");
    expect(resolved.candidates).toHaveLength(1);
  });

  it("a near-miss typo points to the right person without dragging strangers", () => {
    const resolved = resolveOne("anh Hùn", "customer", honorificCustomers);

    expect(resolved.candidates[0]?.name).toBe("anh Hùng");

    const strangerIds = new Set(["c-dat", "c-tuan", "c-lan"]);
    for (const candidate of resolved.candidates) {
      expect(strangerIds.has(candidate.id)).toBe(false);
      expect(candidate.score).toBeGreaterThanOrEqual(
        RESOLVE_THRESHOLDS.CONFIRM_MIN,
      );
    }
  });

  it("resolves a name-only row (no alias) once the honorific is dropped", () => {
    const resolved = resolveOne("Phát", "customer", [
      { id: "c-phat", name: "anh Phát", aliases: [] },
    ]);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-phat");
    expect(resolved.resolved_name).toBe("anh Phát");
    expect(resolved.candidates[0].matched_on).toBe("fuzzy");
  });
});

describe("resolveOne — TIP-004-FIX-2 gendered honorific guard", () => {
  // real-state seed: "anh Phát" now exists in the book.
  const customersWithPhat: EntityRow[] = [
    { id: "c-hung", name: "anh Hùng", aliases: [] },
    { id: "c-tuan", name: "anh Tuấn", aliases: [] },
    { id: "c-lan", name: "chị Lan", aliases: [] },
    { id: "c-dat", name: "anh Đạt", aliases: [] },
    { id: "c-phat", name: "anh Phát", aliases: [] },
  ];

  it("opposite-gender honorific does not match (chị Phát vs anh Phát)", () => {
    const resolved = resolveOne("chị Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("not_found");
    expect(resolved.candidates).toEqual([]);
  });

  it("another female honorific stays not_found too (cô Phát)", () => {
    const resolved = resolveOne("cô Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("not_found");
    expect(resolved.candidates).toEqual([]);
  });

  it("same gender (male-male) still matches (chú Phát -> anh Phát)", () => {
    const resolved = resolveOne("chú Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-phat");
    expect(resolved.resolved_name).toBe("anh Phát");
  });

  it("a genderless query still matches (Phát -> anh Phát)", () => {
    const resolved = resolveOne("Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-phat");
  });

  it("an ambiguous-gender honorific (bác) does not constrain (bác Phát -> anh Phát)", () => {
    const resolved = resolveOne("bác Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-phat");
  });

  it("an exact honorific name still resolves via name_exact (anh Phát)", () => {
    const resolved = resolveOne("anh Phát", "customer", customersWithPhat);

    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_id).toBe("c-phat");
    expect(resolved.candidates[0].matched_on).toBe("name_exact");
  });

  it("asks when both genders of the same bare name exist (Phát -> ambiguous)", () => {
    const resolved = resolveOne("Phát", "customer", [
      ...customersWithPhat,
      { id: "c-phat-f", name: "chị Phát", aliases: [] },
    ]);

    expect(resolved.status).toBe("ambiguous");
    expect(resolved.candidates.map((candidate) => candidate.name)).toEqual([
      "anh Phát",
      "chị Phát",
    ]);
  });

  it("regression: prior TIP-004-FIX behavior holds with anh Phát in the book", () => {
    expect(
      resolveOne("anh Hùng", "customer", customersWithPhat).resolved_name,
    ).toBe("anh Hùng");
    expect(
      resolveOne("Hùng", "customer", customersWithPhat).resolved_name,
    ).toBe("anh Hùng");
    expect(resolveOne("Lan", "customer", customersWithPhat).resolved_name).toBe(
      "chị Lan",
    );
  });
});

describe("resolveEntities", () => {
  it("passes manage_product through Stage 2 without special write handling", async () => {
    const resolved = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        intent: "manage_product",
        raw_text: "đổi đơn vị thép phi 10 thành cây",
        normalized_text: "đổi đơn vị thép phi 10 thành cây",
        entities: {
          ...baseIntent().entities,
          product_name: "Thép phi 10",
          product_management: {
            action: "set_unit",
            product_raw: "thép phi 10",
            unit: "cây",
            sell_price: null,
          },
          items: [],
        },
      }),
    });

    expect(resolved.intent).toBe("manage_product");
    expect(resolved.items[0].resolution.resolved_id).toBe("product-thep-10");
    expect(resolved.customer?.raw).toBeNull();
    expect(resolved.supplier?.raw).toBeNull();
  });

  it("resolves each item independently", async () => {
    const resolved = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        entities: {
          ...baseIntent().entities,
          customer_name: "c\u00f4 lan",
          items: [
            {
              raw: "2 bao xi mang",
              product_name: "xi mang",
              quantity: 2,
              unit: "bao",
              unit_price: null,
              line_total: null,
              confidence: 0.9,
            },
            {
              raw: "100 vien gach do",
              product_name: "gach do",
              quantity: 100,
              unit: "vien",
              unit_price: null,
              line_total: null,
              confidence: 0.88,
            },
          ],
        },
      }),
    });

    expect(resolved.customer?.status).toBe("resolved");
    expect(resolved.supplier?.raw).toBeNull();
    expect(resolved.supplier?.status).toBe("not_found");
    expect(resolved.items).toHaveLength(2);
    expect(resolved.items[0].resolution.resolved_id).toBe("product-xi-mang");
    expect(resolved.items[1].resolution.resolved_id).toBe("product-gach");
    expect(resolved.overall_status).toBe("all_resolved");
  });

  it("creates a synthetic item from top-level product_name", async () => {
    const resolved = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        intent: "query_inventory",
        entities: {
          ...baseIntent().entities,
          product_name: "gach do",
        },
      }),
    });

    expect(resolved.items).toHaveLength(1);
    expect(resolved.items[0]).toMatchObject({
      raw: "gach do",
      product_name: "gach do",
      quantity: null,
      unit: null,
      unit_price: null,
    });
    expect(resolved.items[0].resolution.status).toBe("resolved");
  });

  it("marks has_unresolved only for raw entities that are not found", async () => {
    const resolved = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        entities: {
          ...baseIntent().entities,
          supplier_name: null,
          customer_name: "Khach vang lai XYZ",
        },
      }),
    });

    expect(resolved.supplier?.raw).toBeNull();
    expect(resolved.customer?.status).toBe("not_found");
    expect(resolved.overall_status).toBe("has_unresolved");
    expect(resolved.needs_confirmation).toBe(true);
  });

  it("copies a non-null business date and omits the key when extract has no date", async () => {
    const dated = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        entities: {
          ...baseIntent().entities,
          business_date: "2026-06-01",
        },
      }),
    });
    const undated = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent(),
    });

    expect(dated.business_date).toBe("2026-06-01");
    expect(undated).not.toHaveProperty("business_date");
  });

  it("passes paid_amount through Stage 2", async () => {
    const resolved = await resolveEntities({
      ownerId: "owner-1",
      entityRows: ownerRows,
      intent: baseIntent({
        entities: {
          ...baseIntent().entities,
          paid_amount: 500000,
          payment_status: "partial",
        },
      }),
    });

    expect(resolved.paid_amount).toBe(500000);
    expect(resolved.payment_status).toBe("partial");
  });
});
