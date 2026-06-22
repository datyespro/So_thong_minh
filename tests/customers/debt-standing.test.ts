import { describe, expect, it } from "vitest";
import {
  debtStanding,
  debtStandingSentence,
} from "@/src/lib/customers/debt-standing";

describe("debtStanding (VĐ3 — nguồn quyết định dấu duy nhất)", () => {
  it("treats a positive total as an outstanding debt", () => {
    expect(debtStanding(600_000)).toEqual({ kind: "debt", amount: 600_000 });
  });

  it("treats a negative total as customer credit (we owe them) with a positive amount", () => {
    expect(debtStanding(-77_416_000)).toEqual({
      kind: "credit",
      amount: 77_416_000,
    });
  });

  it("treats zero as settled", () => {
    expect(debtStanding(0)).toEqual({ kind: "settled" });
  });
});

describe("debtStandingSentence", () => {
  it("phrases an outstanding debt", () => {
    expect(debtStandingSentence("chị Lan", 600_000)).toBe(
      "chị Lan đang nợ 600.000 đ",
    );
  });

  it("phrases customer credit instead of saying the debt is cleared", () => {
    expect(debtStandingSentence("chị Lan", -77_416_000)).toBe(
      "chị Lan đã trả trước 77.416.000 đ (mình đang nợ lại khách) ạ.",
    );
  });

  it("phrases a settled balance", () => {
    expect(debtStandingSentence("chị Lan", 0)).toBe("chị Lan không còn nợ ạ.");
  });
});
