import { describe, expect, it } from "vitest";
import {
  buildCategoryBreakdown,
  UNCLASSIFIED_LABEL,
} from "./category-breakdown";

const XIMANG = "cat-ximang";
const CAT = "cat-cat";
const SON = "cat-son";
const DELETED = "cat-deleted";

function categoryName(entries: [string, string][]) {
  return new Map<string, string>(entries);
}

function productCategory(entries: [string, string | null][]) {
  return new Map<string, string | null>(entries);
}

describe("buildCategoryBreakdown (DC-5a — KHÓA phép cộng)", () => {
  it("gom 3 nhóm + Chưa phân loại cuối; remainder === debtTotal", () => {
    const result = buildCategoryBreakdown({
      items: [
        { product_id: "p-xm", line_total: 1_000_000 },
        { product_id: "p-cat", line_total: 500_000 },
        { product_id: null, line_total: 200_000 },
      ],
      payments: [
        { amount: 300_000, scope_category_id: XIMANG },
        { amount: 100_000, scope_category_id: null },
      ],
      productCategory: productCategory([
        ["p-xm", XIMANG],
        ["p-cat", CAT],
      ]),
      categoryName: categoryName([
        [XIMANG, "Xi măng"],
        [CAT, "Cát"],
      ]),
      paidImmediate: 0,
      debtTotal: 1_300_000,
    });

    const ximang = result.groups.find((g) => g.name === "Xi măng");
    const cat = result.groups.find((g) => g.name === "Cát");
    const unclassified = result.groups.find(
      (g) => g.name === UNCLASSIFIED_LABEL,
    );

    expect(ximang).toEqual({
      name: "Xi măng",
      purchased: 1_000_000,
      deposited: 300_000,
      tentative: 700_000,
    });
    expect(cat).toEqual({
      name: "Cát",
      purchased: 500_000,
      deposited: 0,
      tentative: 500_000,
    });
    expect(unclassified).toEqual({
      name: UNCLASSIFIED_LABEL,
      purchased: 200_000,
      deposited: 0,
      tentative: 200_000,
    });

    expect(result.generalDeposit).toBe(100_000);
    expect(result.groupTentativeTotal).toBe(1_400_000);
    expect(result.remainder).toBe(1_300_000);
    expect(result.reconciles).toBe(true);

    // Chưa phân loại luôn ĐỨNG CUỐI.
    expect(result.groups.at(-1)?.name).toBe(UNCLASSIFIED_LABEL);
  });

  it("cọc gắn danh mục ĐÃ xóa mềm → rơi về generalDeposit (không tạo nhóm)", () => {
    const result = buildCategoryBreakdown({
      items: [{ product_id: "p-xm", line_total: 1_000_000 }],
      payments: [{ amount: 50_000, scope_category_id: DELETED }],
      productCategory: productCategory([["p-xm", XIMANG]]),
      categoryName: categoryName([[XIMANG, "Xi măng"]]),
      paidImmediate: 0,
      debtTotal: 950_000,
    });

    expect(result.generalDeposit).toBe(50_000);
    expect(result.groups.map((g) => g.name)).toEqual(["Xi măng"]);
    expect(
      result.groups.find((g) => g.name === UNCLASSIFIED_LABEL),
    ).toBeUndefined();
    expect(result.reconciles).toBe(true);
  });

  it("hàng có product_id nhưng product chưa gắn nhóm → Chưa phân loại", () => {
    const result = buildCategoryBreakdown({
      items: [{ product_id: "p1", line_total: 400_000 }],
      payments: [],
      productCategory: productCategory([["p1", null]]),
      categoryName: categoryName([]),
      paidImmediate: 0,
      debtTotal: 400_000,
    });

    const unclassified = result.groups.find(
      (g) => g.name === UNCLASSIFIED_LABEL,
    );
    expect(unclassified?.purchased).toBe(400_000);
    expect(result.reconciles).toBe(true);
  });

  it("số liệu lệch (mua dòng != tổng đơn) → reconciles=false", () => {
    const result = buildCategoryBreakdown({
      items: [{ product_id: "p-xm", line_total: 900_000 }],
      payments: [],
      productCategory: productCategory([["p-xm", XIMANG]]),
      categoryName: categoryName([[XIMANG, "Xi măng"]]),
      paidImmediate: 0,
      debtTotal: 1_000_000, // != remainder 900_000
    });

    expect(result.remainder).toBe(900_000);
    expect(result.reconciles).toBe(false);
  });

  it("nhóm chỉ có cọc, chưa mua → tentative âm (cọc dư)", () => {
    const result = buildCategoryBreakdown({
      items: [],
      payments: [{ amount: 200_000, scope_category_id: SON }],
      productCategory: productCategory([]),
      categoryName: categoryName([[SON, "Sơn"]]),
      paidImmediate: 0,
      debtTotal: -200_000,
    });

    const son = result.groups.find((g) => g.name === "Sơn");
    expect(son).toEqual({
      name: "Sơn",
      purchased: 0,
      deposited: 200_000,
      tentative: -200_000,
    });
    expect(result.groupTentativeTotal).toBe(-200_000);
    expect(result.remainder).toBe(-200_000);
    expect(result.reconciles).toBe(true);
  });

  it("sắp xếp: Cát, Xi măng, rồi Chưa phân loại cuối cùng", () => {
    const result = buildCategoryBreakdown({
      items: [
        { product_id: null, line_total: 10_000 },
        { product_id: "p-xm", line_total: 10_000 },
        { product_id: "p-cat", line_total: 10_000 },
      ],
      payments: [],
      productCategory: productCategory([
        ["p-xm", XIMANG],
        ["p-cat", CAT],
      ]),
      categoryName: categoryName([
        [XIMANG, "Xi măng"],
        [CAT, "Cát"],
      ]),
      paidImmediate: 0,
      debtTotal: 30_000,
    });

    expect(result.groups.map((g) => g.name)).toEqual([
      "Cát",
      "Xi măng",
      UNCLASSIFIED_LABEL,
    ]);
  });

  it("trừ cả Trả ngay khi mua vào remainder", () => {
    const result = buildCategoryBreakdown({
      items: [{ product_id: "p-xm", line_total: 1_000_000 }],
      payments: [{ amount: 200_000, scope_category_id: XIMANG }],
      productCategory: productCategory([["p-xm", XIMANG]]),
      categoryName: categoryName([[XIMANG, "Xi măng"]]),
      paidImmediate: 300_000,
      debtTotal: 500_000, // 1.000.000 − 200.000(nhóm) − 0(chung) − 300.000(trả ngay)
    });

    expect(result.groupTentativeTotal).toBe(800_000);
    expect(result.remainder).toBe(500_000);
    expect(result.reconciles).toBe(true);
  });

  it("coerce tiền chuỗi/null an toàn về số", () => {
    const result = buildCategoryBreakdown({
      items: [
        { product_id: "p-xm", line_total: "1000000" },
        { product_id: "p-xm", line_total: null },
      ],
      payments: [{ amount: "300000", scope_category_id: XIMANG }],
      productCategory: productCategory([["p-xm", XIMANG]]),
      categoryName: categoryName([[XIMANG, "Xi măng"]]),
      paidImmediate: null,
      debtTotal: "700000",
    });

    const ximang = result.groups.find((g) => g.name === "Xi măng");
    expect(ximang?.purchased).toBe(1_000_000);
    expect(ximang?.deposited).toBe(300_000);
    expect(result.reconciles).toBe(true);
  });
});
