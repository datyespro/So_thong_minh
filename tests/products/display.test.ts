import { describe, expect, it } from "vitest";
import {
  formatProductSellPrice,
  formatProductStock,
  isNegativeProductStock,
} from "@/src/lib/products/display";

describe("product display helpers", () => {
  it("formats a null sell price as an em dash", () => {
    expect(formatProductSellPrice(null)).toBe("—");
  });

  it("formats a sell price with the shared Vietnamese money format", () => {
    expect(formatProductSellPrice("1600000")).toBe("1.600.000 đ");
  });

  it("formats stock values with up to two decimals", () => {
    expect(formatProductStock("12.5")).toBe("12,5");
    expect(formatProductStock(-3)).toBe("-3");
  });

  it("detects negative stock from numeric database values", () => {
    expect(isNegativeProductStock("-0.25")).toBe(true);
    expect(isNegativeProductStock("0")).toBe(false);
  });
});
