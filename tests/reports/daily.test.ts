import { describe, expect, it } from "vitest";
import { businessDateVN } from "@/src/lib/dayjs";
import {
  nextDate,
  normalizeReportDate,
  prevDate,
  reportDateUtcRange,
} from "@/src/lib/reports/daily";

describe("normalizeReportDate", () => {
  it("keeps a valid YYYY-MM-DD date", () => {
    expect(normalizeReportDate("2026-06-10")).toBe("2026-06-10");
  });

  it.each(["2026-13-99", "2026-02-29", "10/06/2026", "rác"])(
    "falls back to today in Vietnam for invalid input %s",
    (value) => {
      expect(normalizeReportDate(value)).toBe(businessDateVN());
    },
  );

  it("falls back to today in Vietnam when the parameter is missing", () => {
    expect(normalizeReportDate(undefined)).toBe(businessDateVN());
  });
});

describe("report date navigation", () => {
  it("moves across the start of a year", () => {
    expect(prevDate("2026-01-01")).toBe("2025-12-31");
  });

  it("moves across the end of a year", () => {
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
  });
});

describe("reportDateUtcRange", () => {
  it("converts a Vietnam calendar day to a half-open UTC range", () => {
    expect(reportDateUtcRange("2026-06-10")).toEqual({
      startUtc: "2026-06-09T17:00:00.000Z",
      endUtc: "2026-06-10T17:00:00.000Z",
    });
  });

  it("keeps a fixed 24-hour range across a global DST boundary", () => {
    const range = reportDateUtcRange("2026-03-29");

    expect(Date.parse(range.endUtc) - Date.parse(range.startUtc)).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(range).toEqual({
      startUtc: "2026-03-28T17:00:00.000Z",
      endUtc: "2026-03-29T17:00:00.000Z",
    });
  });
});
