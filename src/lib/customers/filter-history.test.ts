import { describe, expect, it } from "vitest";
import { filterHistoryRows, isHistoryFiltered, distinctProductNames } from "./filter-history";
import type { CustomerPurchaseHistoryRow } from "./purchase-history";

function createRow(business_date: string | null, product_name: string, line_total: number): CustomerPurchaseHistoryRow {
  return {
    business_date,
    product_name_snapshot: product_name,
    quantity: 1,
    unit_snapshot: "cái",
    unit_price: line_total,
    line_total,
    order_id: "order-1",
    sort_order: 1,
  };
}

describe("filterHistoryRows + isHistoryFiltered", () => {
  const rows: CustomerPurchaseHistoryRow[] = [
    createRow("2026-06-15", "Gạch", 100),
    createRow("2026-06-16", "Xi măng", 200),
    createRow("2026-06-17", "Cát", 300),
  ];

  it("giữ dòng trong khoảng, tính tổng chính xác", () => {
    const result = filterHistoryRows(rows, { fromDate: "2026-06-15", toDate: "2026-06-16", productNames: null });
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]?.business_date).toBe("2026-06-15");
    expect(result.rows[1]?.business_date).toBe("2026-06-16");
    expect(result.total).toBe(300);
  });

  it("giữ hết khi không có filter, isHistoryFiltered=false", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: null });
    expect(result.rows.length).toBe(3);
    expect(result.total).toBe(600);
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: null })).toBe(false);
  });

  it("loại dòng business_date=null khi có filter ngày", () => {
    const rowsWithNull = [...rows, createRow(null, "Sắt", 400)];
    const result = filterHistoryRows(rowsWithNull, { fromDate: "2026-06-15", toDate: null, productNames: null });
    expect(result.rows.length).toBe(3); // 15, 16, 17
    expect(result.rows.some(r => r.business_date === null)).toBe(false);
  });

  it("trả về rỗng khi from > to", () => {
    const result = filterHistoryRows(rows, { fromDate: "2026-06-17", toDate: "2026-06-16", productNames: null });
    expect(result.rows.length).toBe(0);
    expect(result.total).toBe(0);
  });

  it("lấy các tên sản phẩm duy nhất và giữ thứ tự (distinctProductNames)", () => {
    const duplicateRows: CustomerPurchaseHistoryRow[] = [
      createRow("2026-06-15", "xi măng", 100),
      createRow("2026-06-16", "xi măng", 200),
      createRow("2026-06-17", "gạch đỏ", 300),
    ];
    const names = distinctProductNames(duplicateRows);
    expect(names).toEqual(["xi măng", "gạch đỏ"]);
  });
});
