import { describe, expect, test } from "vitest";
import {
  upsertProductSorted,
  removeProductById,
  normalizeSearchText,
  filterProducts,
  countProductsByCategory,
} from "./product-list-utils";
import type { ProductsTableRow } from "./products-table";
import type { CreatedProductView } from "@/app/(app)/chat/actions";

describe("upsertProductSorted", () => {
  const initialList: ProductsTableRow[] = [
    { id: "1", name: "Cát vàng", unit: "m³", sell_price: 200000, current_stock: 10, category_id: null },
    { id: "2", name: "Đá 1x2", unit: "m³", sell_price: 300000, current_stock: 5, category_id: null },
  ];

  test("adds a new product and sorts alphabetically by name", () => {
    const created: CreatedProductView = {
      id: "3",
      name: "Bột trét tường",
      unit: "bao",
      sell_price: 150000,
    };

    const { newList, isDuplicate } = upsertProductSorted(initialList, created);

    expect(isDuplicate).toBe(false);
    expect(newList).toHaveLength(3);
    expect(newList[0].name).toBe("Bột trét tường"); // "B" comes before "C"
    expect(newList[1].name).toBe("Cát vàng");
    expect(newList[2].name).toBe("Đá 1x2");
    
    // Check fields mapping
    expect(newList[0].id).toBe("3");
    expect(newList[0].unit).toBe("bao");
    expect(newList[0].sell_price).toBe(150000);
    expect(newList[0].current_stock).toBe(0); // newly created has 0 stock
  });

  test("identifies a duplicate product by id and returns the original list", () => {
    const duplicate: CreatedProductView = {
      id: "1", // Same id as "Cát vàng"
      name: "Cát vàng",
      unit: "m³",
      sell_price: 200000,
    };

    const { newList, isDuplicate } = upsertProductSorted(initialList, duplicate);

    expect(isDuplicate).toBe(true);
    expect(newList).toBe(initialList);
    expect(newList).toHaveLength(2);
  });
});

describe("removeProductById", () => {
  const list: ProductsTableRow[] = [
    { id: "1", name: "Cát vàng", unit: "m³", sell_price: 200000, current_stock: 10, category_id: null },
    { id: "2", name: "Đá 1x2", unit: "m³", sell_price: 300000, current_stock: 5, category_id: null },
  ];

  test("removes the product with the given id and keeps order", () => {
    const result = removeProductById(list, "1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  test("returns original list shape if id not found", () => {
    const result = removeProductById(list, "999");
    expect(result).toHaveLength(2);
    // filter returns a new array, but elements are same.
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("2");
  });
});

describe("normalizeSearchText", () => {
  test("strips Vietnamese diacritics and lowercases", () => {
    expect(normalizeSearchText("Xi măng Hà Tiên")).toBe("xi mang ha tien");
    expect(normalizeSearchText("ĐÁ")).toBe("da");
    expect(normalizeSearchText("  Thép  ")).toBe("thep");
  });
});

describe("filterProducts", () => {
  const list: ProductsTableRow[] = [
    { id: "1", name: "Xi măng Hà Tiên", unit: "bao", sell_price: 95000, current_stock: 10, category_id: "c-xm" },
    { id: "2", name: "Thép Hòa Phát D10", unit: "kg", sell_price: 13500, current_stock: -3, category_id: "c-thep" },
    { id: "3", name: "Cát vàng", unit: "m³", sell_price: 420000, current_stock: 5, category_id: null },
  ];

  test("matches by name ignoring diacritics and case", () => {
    const result = filterProducts(list, "ha tien", { kind: "all" });
    expect(result.map((p) => p.id)).toEqual(["1"]);
  });

  test("filters by a specific category", () => {
    const result = filterProducts(list, "", { kind: "category", id: "c-thep" });
    expect(result.map((p) => p.id)).toEqual(["2"]);
  });

  test("filters the uncategorized group (category_id null)", () => {
    const result = filterProducts(list, "", { kind: "uncategorized" });
    expect(result.map((p) => p.id)).toEqual(["3"]);
  });

  test("combines search and category filters", () => {
    expect(filterProducts(list, "thep", { kind: "category", id: "c-xm" })).toHaveLength(0);
    expect(filterProducts(list, "cat", { kind: "uncategorized" }).map((p) => p.id)).toEqual(["3"]);
  });
});

describe("countProductsByCategory", () => {
  const list: ProductsTableRow[] = [
    { id: "1", name: "A", unit: "", sell_price: null, current_stock: 0, category_id: "c1" },
    { id: "2", name: "B", unit: "", sell_price: null, current_stock: 0, category_id: "c1" },
    { id: "3", name: "C", unit: "", sell_price: null, current_stock: 0, category_id: "c2" },
    { id: "4", name: "D", unit: "", sell_price: null, current_stock: 0, category_id: null },
  ];

  test("counts total, per-category and uncategorized", () => {
    const counts = countProductsByCategory(list);
    expect(counts.total).toBe(4);
    expect(counts.uncategorized).toBe(1);
    expect(counts.byId).toEqual({ c1: 2, c2: 1 });
  });
});

