import { describe, expect, it } from "vitest";
import { paidForCommit } from "@/src/lib/chat/paid-for-commit";

describe("paidForCommit", () => {
  it("uses the patched order total for a fully paid order", () => {
    expect(paidForCommit("paid", null, 400000)).toBe(400000);
  });

  it("keeps a valid partial payment", () => {
    expect(paidForCommit("partial", 500000, 850000)).toBe(500000);
  });

  it("clamps a partial payment to the patched order total", () => {
    expect(paidForCommit("partial", 900000, 850000)).toBe(850000);
  });

  it("returns zero when the order total is missing or non-positive", () => {
    expect(paidForCommit("paid", null, null)).toBe(0);
    expect(paidForCommit("paid", null, 0)).toBe(0);
  });

  it("returns zero for debt, unknown, or a non-positive partial amount", () => {
    expect(paidForCommit("debt", null, 850000)).toBe(0);
    expect(paidForCommit("unknown", null, 850000)).toBe(0);
    expect(paidForCommit("partial", 0, 850000)).toBe(0);
  });
});
