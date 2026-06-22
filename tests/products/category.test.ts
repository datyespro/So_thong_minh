import { describe, expect, it } from "vitest";
import {
  CATEGORY_NAME_MAX_LENGTH,
  validateCategoryName,
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
