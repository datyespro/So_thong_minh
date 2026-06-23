import { describe, expect, it } from "vitest";
import { filterHistoryRows, isHistoryFiltered, distinctProductNames, distinctCategoryNames, buildProductCategoryIndex, isProductInSelectedGroups, resolveProductChipToggle, type HistoryFilter } from "./filter-history";
import { UNCLASSIFIED_LABEL } from "./category-breakdown";
import type { CustomerPurchaseHistoryRow } from "./purchase-history";

function createRow(
  business_date: string | null,
  product_name: string,
  line_total: number,
  category_name: string | null = null,
): CustomerPurchaseHistoryRow {
  return {
    business_date,
    product_name_snapshot: product_name,
    quantity: 1,
    unit_snapshot: "cái",
    unit_price: line_total,
    line_total,
    order_id: "order-1",
    sort_order: 1,
    category_name,
  };
}

describe("filterHistoryRows + isHistoryFiltered", () => {
  const rows: CustomerPurchaseHistoryRow[] = [
    createRow("2026-06-15", "Gạch", 100),
    createRow("2026-06-16", "Xi măng", 200),
    createRow("2026-06-17", "Cát", 300),
  ];

  it("giữ dòng trong khoảng, tính tổng chính xác", () => {
    const result = filterHistoryRows(rows, { fromDate: "2026-06-15", toDate: "2026-06-16", productNames: null, categoryNames: null });
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]?.business_date).toBe("2026-06-15");
    expect(result.rows[1]?.business_date).toBe("2026-06-16");
    expect(result.total).toBe(300);
  });

  it("giữ hết khi không có filter, isHistoryFiltered=false", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: null, categoryNames: null });
    expect(result.rows.length).toBe(3);
    expect(result.total).toBe(600);
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: null, categoryNames: null })).toBe(false);
  });

  it("loại dòng business_date=null khi có filter ngày", () => {
    const rowsWithNull = [...rows, createRow(null, "Sắt", 400)];
    const result = filterHistoryRows(rowsWithNull, { fromDate: "2026-06-15", toDate: null, productNames: null, categoryNames: null });
    expect(result.rows.length).toBe(3); // 15, 16, 17
    expect(result.rows.some(r => r.business_date === null)).toBe(false);
  });

  it("trả về rỗng khi from > to", () => {
    const result = filterHistoryRows(rows, { fromDate: "2026-06-17", toDate: "2026-06-16", productNames: null, categoryNames: null });
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
  it("lọc theo một mặt hàng, tính tổng đúng", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: ["Xi măng"], categoryNames: null });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.product_name_snapshot).toBe("Xi măng");
    expect(result.total).toBe(200);
  });

  it("lọc nhiều mặt hàng (OR)", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: ["Gạch", "Cát"], categoryNames: null });
    expect(result.rows.length).toBe(2);
    expect(result.rows.map(r => r.product_name_snapshot).sort()).toEqual(["Cát", "Gạch"]);
  });

  it("kết hợp ngày và mặt hàng (AND)", () => {
    const result = filterHistoryRows(rows, { fromDate: "2026-06-16", toDate: null, productNames: ["Cát"], categoryNames: null });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.product_name_snapshot).toBe("Cát");
    expect(result.rows[0]?.business_date).toBe("2026-06-17");
  });

  it("isHistoryFiltered với productNames", () => {
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: ["X"], categoryNames: null })).toBe(true);
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: [], categoryNames: null })).toBe(false);
  });
});

describe("DC-5b — lọc theo nhóm (categoryNames)", () => {
  const rows: CustomerPurchaseHistoryRow[] = [
    createRow("2026-06-15", "Xi măng PCB40", 100, "Xi măng"),
    createRow("2026-06-16", "Cát vàng", 200, "Cát"),
    createRow("2026-06-17", "Đinh 5cm", 300, null), // chưa phân loại
  ];

  it("lọc 1 nhóm, tính tổng đúng", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: null, categoryNames: ["Xi măng"] });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.product_name_snapshot).toBe("Xi măng PCB40");
    expect(result.total).toBe(100);
  });

  it('chip "Chưa phân loại" khớp dòng category_name=null', () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: null, categoryNames: [UNCLASSIFIED_LABEL] });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.product_name_snapshot).toBe("Đinh 5cm");
    expect(result.total).toBe(300);
  });

  it("lọc nhiều nhóm (OR)", () => {
    const result = filterHistoryRows(rows, { fromDate: null, toDate: null, productNames: null, categoryNames: ["Xi măng", "Cát"] });
    expect(result.rows.map((r) => r.category_name).sort()).toEqual(["Cát", "Xi măng"]);
    expect(result.total).toBe(300);
  });

  it("kết hợp nhóm + ngày + tên (AND cả ba lớp)", () => {
    const richRows: CustomerPurchaseHistoryRow[] = [
      createRow("2026-06-15", "Xi măng PCB40", 100, "Xi măng"),
      createRow("2026-06-20", "Xi măng PCB40", 150, "Xi măng"),
      createRow("2026-06-20", "Cát vàng", 200, "Cát"),
    ];
    const result = filterHistoryRows(richRows, {
      fromDate: "2026-06-18",
      toDate: null,
      productNames: ["Xi măng PCB40"],
      categoryNames: ["Xi măng"],
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.business_date).toBe("2026-06-20");
    expect(result.total).toBe(150);
  });

  it("distinctCategoryNames: sort A→Z (vi), Chưa phân loại cuối", () => {
    const dupRows: CustomerPurchaseHistoryRow[] = [
      createRow("2026-06-17", "Đinh", 300, null),
      createRow("2026-06-15", "Xi măng PCB40", 100, "Xi măng"),
      createRow("2026-06-16", "Cát vàng", 200, "Cát"),
      createRow("2026-06-18", "Xi măng trắng", 100, "Xi măng"), // trùng nhóm
    ];
    expect(distinctCategoryNames(dupRows)).toEqual([
      "Cát",
      "Xi măng",
      UNCLASSIFIED_LABEL,
    ]);
  });

  it("isHistoryFiltered nhận categoryNames", () => {
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: null, categoryNames: ["Xi măng"] })).toBe(true);
    expect(isHistoryFiltered({ fromDate: null, toDate: null, productNames: null, categoryNames: [] })).toBe(false);
  });
});

describe("DC-5c — sáng mặt hàng theo nhóm + bỏ nhóm khi bấm SP ngoài", () => {
  const rows: CustomerPurchaseHistoryRow[] = [
    createRow("2026-06-15", "Thép D6", 100, "Thép"),
    createRow("2026-06-16", "cát đen", 200, null), // chưa phân loại
  ];

  it("buildProductCategoryIndex: map đúng + coalesce null", () => {
    const index = buildProductCategoryIndex(rows);
    expect(index.get("Thép D6")?.has("Thép")).toBe(true);
    expect(index.get("cát đen")?.has(UNCLASSIFIED_LABEL)).toBe(true);
  });

  it("buildProductCategoryIndex: 1 SP thuộc >1 nhóm (lịch sử đổi danh mục)", () => {
    const dupRows: CustomerPurchaseHistoryRow[] = [
      createRow("2026-06-15", "D6", 100, "Thép"),
      createRow("2026-06-16", "D6", 100, "Sắt thép"),
    ];
    const index = buildProductCategoryIndex(dupRows);
    expect(index.get("D6")).toEqual(new Set(["Thép", "Sắt thép"]));
  });

  it("isProductInSelectedGroups: 4 ca", () => {
    const index = buildProductCategoryIndex(rows);
    expect(isProductInSelectedGroups(index, "Thép D6", null)).toBe(true); // không lọc nhóm → tất cả thuộc
    expect(isProductInSelectedGroups(index, "Thép D6", ["Thép"])).toBe(true);
    expect(isProductInSelectedGroups(index, "cát đen", ["Thép"])).toBe(false);
    expect(isProductInSelectedGroups(index, "Thép D6", ["Gạch", "Thép"])).toBe(true);
  });

  it("resolveProductChipToggle: SP TRONG nhóm → giữ nhóm", () => {
    const index = buildProductCategoryIndex(rows);
    const filter: HistoryFilter = { fromDate: null, toDate: null, productNames: null, categoryNames: ["Thép"] };
    const result = resolveProductChipToggle(filter, "Thép D6", index);
    expect(result.categoryNames).toEqual(["Thép"]);
    expect(result.productNames).toEqual(["Thép D6"]);
  });

  it("resolveProductChipToggle: SP NGOÀI nhóm → bỏ nhóm về Chung", () => {
    const index = buildProductCategoryIndex(rows);
    const filter: HistoryFilter = { fromDate: null, toDate: null, productNames: null, categoryNames: ["Thép"] };
    const result = resolveProductChipToggle(filter, "cát đen", index);
    expect(result.categoryNames).toBeNull();
    expect(result.productNames).toEqual(["cát đen"]);
  });

  it("resolveProductChipToggle: không chọn nhóm → toggle bình thường (bỏ chọn)", () => {
    const index = buildProductCategoryIndex(rows);
    const filter: HistoryFilter = { fromDate: null, toDate: null, productNames: ["cát đen"], categoryNames: null };
    const result = resolveProductChipToggle(filter, "cát đen", index);
    expect(result.productNames).toBeNull();
    expect(result.categoryNames).toBeNull();
  });
});
