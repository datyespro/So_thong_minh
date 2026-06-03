import { describe, expect, it } from "vitest";
import {
  parseProductSellPriceInput,
  validateProductUpdatePatch,
} from "@/src/lib/products/update";

describe("product update validation", () => {
  it("rejects blank units", () => {
    expect(validateProductUpdatePatch({ unit: "   " })).toEqual({
      ok: false,
      message: "Đơn vị không được để trống",
    });
  });

  it("parses blank and null prices as null", () => {
    expect(parseProductSellPriceInput("")).toEqual({ ok: true, value: null });
    expect(parseProductSellPriceInput(null)).toEqual({ ok: true, value: null });
  });

  it("parses digit prices with thousand separators", () => {
    expect(parseProductSellPriceInput("80.000")).toEqual({
      ok: true,
      value: 80000,
    });
  });

  it("rounds numeric prices to integer VND", () => {
    expect(parseProductSellPriceInput(80000.6)).toEqual({
      ok: true,
      value: 80001,
    });
  });

  it("rejects negative and non-numeric prices", () => {
    expect(parseProductSellPriceInput("-5")).toEqual({
      ok: false,
      message: "Giá không hợp lệ",
    });
    expect(parseProductSellPriceInput("abc")).toEqual({
      ok: false,
      message: "Giá không hợp lệ",
    });
  });

  it("builds an update payload with only allowed fields", () => {
    expect(validateProductUpdatePatch({ unit: " bao ", sell_price: "80.000" })).toEqual({
      ok: true,
      data: {
        patch: {
          unit: "bao",
          sell_price: 80000,
        },
        fields: ["unit", "sell_price"],
      },
    });
  });
});
