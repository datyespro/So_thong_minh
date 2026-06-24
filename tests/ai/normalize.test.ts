import { describe, expect, it } from "vitest";
import {
  diceSimilarity,
  foldCaseVi,
  normalizeVi,
  trigramSet,
} from "@/src/lib/ai/normalize";

describe("normalizeVi", () => {
  it("lowercases, strips Vietnamese marks, maps d-stroke, and trims spaces", () => {
    expect(
      normalizeVi("  \u0110\u1eb7ng   Th\u1ecb  \u00c1nh  "),
    ).toBe("dang thi anh");
  });

  it("collapses repeated whitespace", () => {
    expect(normalizeVi("Xi\tm\u0103ng\nH\u00e0   Ti\u00ean")).toBe(
      "xi mang ha tien",
    );
  });
});

describe("foldCaseVi", () => {
  it("lowercases, NFC-normalizes, collapses spaces, and trims — but KEEPS marks", () => {
    expect(foldCaseVi("Ngọc  ÁNH")).toBe("ngọc ánh");
  });

  it("distinguishes names that differ only by diacritics", () => {
    expect(foldCaseVi("Ngọc Anh")).not.toBe(foldCaseVi("Ngọc Ánh"));
  });
});

describe("trigramSet", () => {
  it("pads with two leading spaces and one trailing space", () => {
    expect([...trigramSet("Lan")]).toEqual(["  l", " la", "lan", "an "]);
  });

  it("returns an empty set for empty normalized input", () => {
    expect(trigramSet("   ").size).toBe(0);
  });
});

describe("diceSimilarity", () => {
  it("returns 1 for normalized exact matches", () => {
    expect(diceSimilarity("C\u00f4 Lan", "co lan")).toBe(1);
  });

  it("returns 0 when either side is empty", () => {
    expect(diceSimilarity("", "co lan")).toBe(0);
    expect(diceSimilarity("", "")).toBe(0);
  });

  it("scores close Vietnamese product names higher than unrelated names", () => {
    expect(diceSimilarity("xi mang trang", "Xi m\u0103ng")).toBeGreaterThan(
      diceSimilarity("khach vang lai", "Xi m\u0103ng"),
    );
  });
});
