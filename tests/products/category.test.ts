import { describe, expect, it } from "vitest";
import {
  CATEGORY_NAME_MAX_LENGTH,
  normalizeCategoryName,
  resolvePaymentScopeCategory,
  validateCategoryName,
  type CategoryView,
} from "@/src/lib/products/category";

describe("validateCategoryName", () => {
  it("trims and accepts a valid name", () => {
    expect(validateCategoryName("  Sắt thép  ")).toEqual({
      ok: true,
      value: "Sắt thép",
    });
  });

  it("rejects blank or whitespace-only names", () => {
    expect(validateCategoryName("   ")).toEqual({
      ok: false,
      message: "Tên danh mục không được để trống",
    });
    expect(validateCategoryName("")).toEqual({
      ok: false,
      message: "Tên danh mục không được để trống",
    });
  });

  it("rejects non-string input", () => {
    expect(validateCategoryName(null)).toEqual({
      ok: false,
      message: "Tên danh mục không được để trống",
    });
    expect(validateCategoryName(123)).toEqual({
      ok: false,
      message: "Tên danh mục không được để trống",
    });
  });

  it("rejects names longer than the max length", () => {
    const tooLong = "x".repeat(CATEGORY_NAME_MAX_LENGTH + 1);
    expect(validateCategoryName(tooLong)).toEqual({
      ok: false,
      message: "Tên danh mục quá dài",
    });
  });

  it("accepts a name exactly at the max length", () => {
    const exact = "x".repeat(CATEGORY_NAME_MAX_LENGTH);
    expect(validateCategoryName(exact)).toEqual({ ok: true, value: exact });
  });
});

describe("normalizeCategoryName", () => {
  it("trims and lowercases (giữ dấu, không bỏ diacritic)", () => {
    expect(normalizeCategoryName("  Gạch  ")).toBe("gạch");
    expect(normalizeCategoryName("Thép")).toBe("thép");
  });
});

describe("resolvePaymentScopeCategory", () => {
  const categories: CategoryView[] = [
    { id: "cat-gach", name: "Gạch" },
    { id: "cat-thep", name: "Thép" },
    { id: "cat-xi", name: "Xi măng" },
  ];

  it("none khi raw null/rỗng/khoảng trắng", () => {
    expect(resolvePaymentScopeCategory(null, categories)).toEqual({
      status: "none",
    });
    expect(resolvePaymentScopeCategory("", categories)).toEqual({
      status: "none",
    });
    expect(resolvePaymentScopeCategory("   ", categories)).toEqual({
      status: "none",
    });
  });

  it("matched khi khớp đúng 1 (chuẩn hoá hoa/thường + dấu)", () => {
    expect(resolvePaymentScopeCategory("gạch", categories)).toEqual({
      status: "matched",
      categoryId: "cat-gach",
    });
    // "Thép" user gõ hoa, danh mục "Thép" → vẫn khớp qua hạ thường.
    expect(resolvePaymentScopeCategory("Thép", categories)).toEqual({
      status: "matched",
      categoryId: "cat-thep",
    });
    expect(resolvePaymentScopeCategory("  XI MĂNG ", categories)).toEqual({
      status: "matched",
      categoryId: "cat-xi",
    });
  });

  it("not_found khi có raw nhưng 0 khớp (vd 'vữa')", () => {
    expect(resolvePaymentScopeCategory("vữa", categories)).toEqual({
      status: "not_found",
    });
  });

  it("ambiguous khi khớp >1 danh mục cùng tên chuẩn-hoá", () => {
    const dup: CategoryView[] = [
      { id: "c1", name: "Gạch" },
      { id: "c2", name: " gạch " },
    ];
    expect(resolvePaymentScopeCategory("Gạch", dup)).toEqual({
      status: "ambiguous",
    });
  });
});
