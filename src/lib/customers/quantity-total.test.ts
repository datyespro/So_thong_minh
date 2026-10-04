import { describe, expect, it } from "vitest";
import type { CustomerPurchaseHistoryRow } from "./purchase-history";
import { sumCustomerPurchaseHistoryQuantity } from "./quantity-total";

function row(overrides: Partial<CustomerPurchaseHistoryRow> = {}): CustomerPurchaseHistoryRow {
  return {
    order_id: "order-1",
    product_id: "P1",
    business_date: "2026-10-04",
    product_name_snapshot: "Cát vàng",
    quantity: 1,
    unit_snapshot: "m³",
    unit_price: 800000,
    line_total: 800000,
    sort_order: 1,
    category_name: "Cát",
    ...overrides,
  };
}

describe("sumCustomerPurchaseHistoryQuantity", () => {
  it.each([
    { quantities: [1.5, 2], expected: "3,5" },
    { quantities: [0.1, 0.2], expected: "0,3" },
    { quantities: [1.25, "2.50"], expected: "3,75" },
    { quantities: ["1.00", "2.00"], expected: "3" },
    { quantities: ["0.10", "0.20"], expected: "0,3" },
    { quantities: ["0.01"], expected: "0,01" },
  ])("adds $quantities exactly as $expected", ({ quantities, expected }) => {
    expect(sumCustomerPurchaseHistoryQuantity(quantities.map((quantity) => row({ quantity }))))
      .toEqual({ quantityDisplay: expected, unitDisplay: "m³" });
  });

  it("has no total for no rows and allows a single row", () => {
    expect(sumCustomerPurchaseHistoryQuantity([])).toBeNull();
    expect(sumCustomerPurchaseHistoryQuantity([row({ quantity: 3, unit_snapshot: "bao" })]))
      .toEqual({ quantityDisplay: "3", unitDisplay: "bao" });
  });

  it("uses exact ID regardless of names, dates, prices, orders or categories", () => {
    expect(sumCustomerPurchaseHistoryQuantity([
      row({ quantity: 1.5 }),
      row({ quantity: 2, product_name_snapshot: "Cát đổi tên", business_date: "2025-01-01",
        unit_price: 1, line_total: 2, category_name: "Nhóm khác", order_id: "order-2" }),
    ])).toEqual({ quantityDisplay: "3,5", unitDisplay: "m³" });
    expect(sumCustomerPurchaseHistoryQuantity([row(), row({ product_id: "P2" })])).toBeNull();
    expect(sumCustomerPurchaseHistoryQuantity([row(), row({ product_id: " P1 " })])).toBeNull();
  });

  it.each([null, undefined, "", " \t "])("rejects missing or blank ID %s", (product_id) => {
    const invalid = { ...row(), product_id } as CustomerPurchaseHistoryRow;
    expect(sumCustomerPurchaseHistoryQuantity([row(), invalid])).toBeNull();
  });

  it.each([
    { units: ["m3", "m³", "mét khối", "khối", "m khối"], expected: "m³" },
    { units: ["m2", "m²", "mét vuông", "met vuong"], expected: "m²" },
    { units: [" bao ", "BAO"], expected: "bao" },
    { units: ["BÓ   CÂY", " bó\tcây "], expected: "bó cây" },
  ])("canonicalizes $units", ({ units, expected }) => {
    const rows = units.map((unit_snapshot) => row({ unit_snapshot }));
    const wanted = { quantityDisplay: String(units.length), unitDisplay: expected };
    expect(sumCustomerPurchaseHistoryQuantity(rows)).toEqual(wanted);
    expect(sumCustomerPurchaseHistoryQuantity([...rows].reverse())).toEqual(wanted);
  });

  it.each([
    ["m³", "m²"], ["m³", "xe"], ["bao", "kg"], ["kg", "tấn"], ["cây", "cay"],
  ])("does not merge distinct units %s and %s", (left, right) => {
    expect(sumCustomerPurchaseHistoryQuantity([row({ unit_snapshot: left }), row({ unit_snapshot: right })]))
      .toBeNull();
  });

  it.each([null, undefined, "", " \t ", "—", " — "])("rejects unavailable unit %s", (unit_snapshot) => {
    const invalid = { ...row(), unit_snapshot } as CustomerPurchaseHistoryRow;
    expect(sumCustomerPurchaseHistoryQuantity([row(), invalid])).toBeNull();
  });

  it.each([
    "", " ", "abc", "1,5", "1e2", "1E2", "+1", "-1", "01", ".5", "1.",
    " 1.50", "1.50 ", "0", "0.00", "0.001", "1.000", "NaN", "Infinity",
    0, -1, NaN, Infinity, -Infinity, 0.001, 0.30000000000000004,
    null, undefined, true, {},
  ])("rejects invalid quantity %s without partial sum", (quantity) => {
    const invalid = { ...row(), quantity } as CustomerPurchaseHistoryRow;
    expect(sumCustomerPurchaseHistoryQuantity([row({ quantity: 2 }), invalid])).toBeNull();
    expect(sumCustomerPurchaseHistoryQuantity([invalid, row({ quantity: 2 })])).toBeNull();
  });

  it("preserves large DB decimal amounts and accepts a total exceeding one DB row", () => {
    expect(sumCustomerPurchaseHistoryQuantity([
      row({ quantity: "999999999999.99" }), row({ quantity: "0.01" }),
    ])).toEqual({ quantityDisplay: "1000000000000", unitDisplay: "m³" });
    expect(sumCustomerPurchaseHistoryQuantity([row({ quantity: 999999999999.99 })]))
      .toEqual({ quantityDisplay: "999999999999,99", unitDisplay: "m³" });
  });

  it.each(["1000000000000", 1000000000000, "9".repeat(1000), Number.MAX_VALUE, 1e-7])
    ("rejects quantity outside the declared DB scale/range %s", (quantity) => {
      expect(sumCustomerPurchaseHistoryQuantity([row(), row({ quantity })])).toBeNull();
    });

  it("accepts aggregate cents at MAX_SAFE_INTEGER and hides one cent beyond", () => {
    // 90 * 999999999999.99 + 71992547410.81 = 90071992547409.91.
    const rows = [
      ...Array.from({ length: 90 }, () => row({ quantity: "999999999999.99" })),
      row({ quantity: "71992547410.81" }),
    ];
    expect(sumCustomerPurchaseHistoryQuantity(rows))
      .toEqual({ quantityDisplay: "90071992547409,91", unitDisplay: "m³" });
    expect(sumCustomerPurchaseHistoryQuantity([...rows, row({ quantity: "0.01" })])).toBeNull();
  });

  it("does not mutate input, counts each supplied row once and exports JSON-safe strings", () => {
    const rows = Object.freeze([
      Object.freeze(row({ quantity: "1.25" })), Object.freeze(row({ quantity: "2.50" })),
    ]);
    const before = JSON.stringify(rows);
    const total = sumCustomerPurchaseHistoryQuantity(rows);
    expect(total).toEqual({ quantityDisplay: "3,75", unitDisplay: "m³" });
    expect(sumCustomerPurchaseHistoryQuantity([...rows].reverse())).toEqual(total);
    expect(sumCustomerPurchaseHistoryQuantity([rows[1]]))
      .toEqual({ quantityDisplay: "2,5", unitDisplay: "m³" });
    expect(JSON.stringify(total)).toBe('{"quantityDisplay":"3,75","unitDisplay":"m³"}');
    expect(JSON.stringify(rows)).toBe(before);
  });
});
