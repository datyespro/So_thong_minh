import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseHistoryTable } from "@/src/components/customers/purchase-history-table";
import { buildProductCategoryIndex, distinctCategoryNames, distinctProductNames, filterHistoryRows, isHistoryFiltered, type HistoryFilter } from "@/src/lib/customers/filter-history";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";

const mock = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/src/components/customers/history-filter-provider", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/src/components/customers/history-filter-provider")>(),
  useHistoryFilter: mock.context,
}));
vi.mock("@/src/components/invoice/printable-customer-section", () => ({
  InvoiceActionPopover: ({ orderId }: { orderId: string }) => <button data-order={orderId}>In</button>,
}));

const clear: HistoryFilter = { fromDate: null, toDate: null, productNames: null, categoryNames: null };
const rows: CustomerPurchaseHistoryRow[] = [
  { order_id: "o1", product_id: "p1", business_date: "2026-10-01", product_name_snapshot: "Cát vàng", quantity: "1.50", unit_snapshot: "m3", unit_price: 800_000, line_total: 1_200_000, sort_order: 0, category_name: "Cát" },
  { order_id: "o2", product_id: "p1", business_date: "2026-10-03", product_name_snapshot: "Cát vàng", quantity: 2, unit_snapshot: "m³", unit_price: 800_000, line_total: 1_600_000, sort_order: 0, category_name: "Cát" },
];
const ordinary: CustomerDebtSummary = { totalPurchase: 2_800_000, paidImmediate: 0, paidLater: 0, paidTotal: 0, debtTotal: 2_800_000, reconciles: true };
const paid: CustomerDebtSummary = { ...ordinary, paidImmediate: 300_000, paidLater: 500_000, paidTotal: 800_000, debtTotal: 2_000_000 };

function render(input = rows, filter: HistoryFilter = clear, summary = ordinary, sort: "date_asc" | "date_desc" = "date_asc") {
  const result = filterHistoryRows(input, filter);
  mock.context.mockReturnValue({ filter, setFilter: vi.fn(), filteredRows: result.rows, filteredTotal: result.total,
    isFiltered: isHistoryFiltered(filter), productNameOptions: distinctProductNames(input), categoryNameOptions: distinctCategoryNames(input), productCategoryIndex: buildProductCategoryIndex(input) });
  return renderToStaticMarkup(<PurchaseHistoryTable summary={summary} payments={[{ id: "pay1", amount: 500_000, paid_at: "2026-10-04" }]} customerId="fixture" sort={sort} nextSort={sort === "date_asc" ? "date_desc" : "date_asc"} />);
}

function quantity(html: string, value: string, unit: string) {
  expect(html.match(/Tổng số lượng/g)).toHaveLength(2);
  const footer = html.split("<tfoot")[1].split("</tfoot>")[0];
  expect(footer).toContain(value);
  expect(footer).toContain(unit);
  for (const row of footer.matchAll(/<tr>(.*?)<\/tr>/g)) {
    const columns = [...row[1].matchAll(/<td(?:\s[^>]*)?>/g)].reduce((sum, cell) => sum + Number(cell[0].match(/colSpan="(\d+)"/)?.[1] ?? 1), 0);
    expect(columns).toBe(7);
  }
  expect(html).toContain(`${value} ${unit}</p>`);
}

beforeEach(() => mock.context.mockReset());
describe("PurchaseHistoryTable quantity footer", () => {
  it("renders one footer per responsive surface, seven columns and unchanged money", () => {
    const html = render();
    quantity(html, "3,5", "m³");
    expect(html.match(/Tổng cộng/g)).toHaveLength(2);
    expect(html.match(/2\.800\.000 đ/g)).toHaveLength(2);
    expect(html).not.toContain("= Còn nợ");
    const footer = html.split("<tfoot")[1].split("</tfoot>")[0];
    expect(footer.match(/<tr>/g)).toHaveLength(1);
    const cells = [...footer.matchAll(/<td(?:\s[^>]*)?>(.*?)<\/td>/g)].map(cell => cell[1]);
    expect(cells[0]).toBe("Tổng cộng");
    expect(cells[1]).toContain("Tổng số lượng");
    expect(cells[1]).toContain("3,5");
    expect(cells[2]).toBe("m³");
    expect(cells[4]).toContain("Tổng tiền");
    expect(cells[4]).toContain("2.800.000 đ");
    expect(html).toContain("divide-x divide-ledgerBorder");
    expect(html).toContain("[&amp;&gt;div]:border-0");
  });
  it("coexists with unchanged debt payments and immediate-payment labels on both surfaces", () => {
    const html = render(rows, clear, paid);
    quantity(html, "3,5", "m³");
    const footer = html.split("<tfoot")[1].split("</tfoot>")[0];
    expect(footer.match(/<tr>/g)).toHaveLength(2);
    expect(footer).toContain('colSpan="7"');
    expect(html).not.toContain("divide-x divide-ledgerBorder");
    for (const label of ["Tổng mua", "− Trả 04/10/2026", "− Trả ngay khi mua", "= Còn nợ"]) expect(html.match(new RegExp(label, "g"))).toHaveLength(2);
    expect(html.match(/2\.000\.000 đ/g)).toHaveLength(2);
    expect(html.match(/300\.000 đ/g)).toHaveLength(2);
    expect(html.match(/500\.000 đ/g)).toHaveLength(2);
  });
  it("retains prepaid-credit label", () => {
    const html = render(rows, clear, { ...paid, paidLater: 3_000_000, paidTotal: 3_300_000, debtTotal: -500_000 });
    quantity(html, "3,5", "m³");
    expect(html.match(/= Khách trả trước/g)).toHaveLength(2);
    expect(html).not.toContain("= Còn nợ");
  });
  it.each([ordinary, paid])("hides invalid quantities in both footer branches without hiding money", (summary) => {
    for (const patch of [{ product_id: "p2" }, { product_id: null }, { unit_snapshot: "kg" }, { unit_snapshot: null }, { quantity: "" }, { quantity: NaN }, { quantity: Infinity }, { quantity: 0 }, { quantity: -1 }, { quantity: "0.001" }]) {
      const html = render([rows[0], { ...rows[1], ...patch }], clear, summary);
      expect(html).not.toContain("Tổng số lượng");
      expect(html).toContain("2.800.000 đ");
      expect(html).toContain(summary.paidTotal ? "= Còn nợ" : "Tổng cộng");
    }
  });
  it("hides an empty result and renders a single valid row", () => {
    expect(render([])).not.toContain("Tổng số lượng");
    quantity(render([rows[0]]), "1,5", "m³");
  });
  it("uses actual date, product and category filters with AND; clear and reversed dates", () => {
    const input = [...rows, { ...rows[1], order_id: "o3", product_id: "p2", product_name_snapshot: "Xi măng", unit_snapshot: "bao", category_name: "Xi măng" }];
    quantity(render(input, { ...clear, toDate: "2026-10-01" }), "1,5", "m³");
    quantity(render(input, { ...clear, productNames: ["Cát vàng"] }), "3,5", "m³");
    quantity(render(input, { ...clear, categoryNames: ["Cát"] }), "3,5", "m³");
    quantity(render(input, { ...clear, fromDate: "2026-10-03", productNames: ["Cát vàng"], categoryNames: ["Cát"] }), "2", "m³");
    expect(render(input, { ...clear, productNames: ["Cát vàng"], categoryNames: ["Xi măng"] })).not.toContain("Tổng số lượng");
    expect(render(input, { ...clear, fromDate: "2026-10-04", toDate: "2026-10-01" })).not.toContain("Tổng số lượng");
    expect(render(input, clear)).not.toContain("Tổng số lượng");
    quantity(render(rows, clear), "3,5", "m³");
  });
  it("does not double-count grouped items or change totals after sort", () => {
    const grouped = rows.map((row, i) => ({ ...row, order_id: "o1", sort_order: i }));
    for (const sort of ["date_asc", "date_desc"] as const) quantity(render(sort === "date_desc" ? [...grouped].reverse() : grouped, clear, ordinary, sort), "3,5", "m³");
  });
  it("allows renamed snapshots and different prices, but identical name chips with mixed IDs hide", () => {
    quantity(render([rows[0], { ...rows[1], product_name_snapshot: "Cát đổi tên", unit_price: 900_000, line_total: 1_800_000 }]), "3,5", "m³");
    expect(render([rows[0], { ...rows[1], product_id: "p2" }], { ...clear, productNames: ["Cát vàng"] })).not.toContain("Tổng số lượng");
  });
  it("wraps large totals and long units on both surfaces", () => {
    const unit = "đơnvịrấtdàikhôngcókhoảngtrắng";
    const html = render(rows.map(row => ({ ...row, quantity: "999999999999.99", unit_snapshot: unit })));
    quantity(html, "1999999999999,98", unit);
    expect(html).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]");
    expect(html.match(/\[overflow-wrap:anywhere\]/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
