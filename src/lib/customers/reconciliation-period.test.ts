import { describe, expect, it } from "vitest";
import { earliestBusinessDate } from "./reconciliation-period";

describe("earliestBusinessDate", () => {
  it("returns null for empty array or no dates", () => {
    expect(earliestBusinessDate([])).toBeNull();
    expect(earliestBusinessDate([{ business_date: null }])).toBeNull();
  });

  it("returns earliest date", () => {
    expect(
      earliestBusinessDate([
        { business_date: "2026-06-16" },
        { business_date: "2026-06-15" },
        { business_date: "2026-06-17" },
      ])
    ).toBe("2026-06-15");
  });

  it("ignores null dates", () => {
    expect(
      earliestBusinessDate([
        { business_date: null },
        { business_date: "2026-06-10" },
      ])
    ).toBe("2026-06-10");
  });
});
