import { describe, expect, it } from "vitest";
import { buildPeriodLedger, earliestTransactionDate } from "./reconciliation-period";

describe("earliestTransactionDate", () => {
  it("returns null for empty array or no dates", () => {
    expect(earliestTransactionDate([], [])).toBeNull();
    expect(earliestTransactionDate([{ business_date: null }], [])).toBeNull();
  });

  it("returns earliest date", () => {
    expect(
      earliestTransactionDate([
        { business_date: "2026-06-16" },
        { business_date: "2026-06-15" },
        { business_date: "2026-06-17" },
      ], [])
    ).toBe("2026-06-15");
  });

  it("ignores null dates", () => {
    expect(
      earliestTransactionDate([
        { business_date: null },
        { business_date: "2026-06-10" },
      ], [])
    ).toBe("2026-06-10");
  });
  it("includes payment-only history and ignores invalid payment dates", () => {
    expect(earliestTransactionDate([], [
      { paid_at: null }, { paid_at: "invalid" }, { paid_at: "2026-11-07T17:30:00Z" },
    ])).toBe("2026-11-08");
    expect(earliestTransactionDate([{ business_date: "2026-09-21" }], [
      { paid_at: "2026-09-14T03:00:00Z" },
    ])).toBe("2026-09-14");
    expect(earliestTransactionDate([{ business_date: "2026-06-10" }], [
      { paid_at: "2026-09-14T03:00:00Z" },
    ])).toBe("2026-06-10");
    expect(earliestTransactionDate([{ business_date: "" }], [{ paid_at: null }])).toBeNull();
  });

});

// F1: khách Vinh+giang nghĩa sau khi xoá đơn "công nợ cũ" 20tr (spec 2026-11-21-period-opening-debt).
const F1_ORDERS = [
  { business_date: "2026-09-21", total_amount: 182_887_700, paid_amount: 0 },
  { business_date: "2026-10-15", total_amount: "100000000.00", paid_amount: null },
  { business_date: "2026-11-08", total_amount: 40_000_000, paid_amount: 0 },
  { business_date: "2026-11-21", total_amount: 36_530_000, paid_amount: 0 },
];
const F1_PAYMENTS = [
  { id: "p1", amount: 200_000_000, paid_at: "2026-09-14T03:00:00Z" },
  { id: "p2", amount: "62887700", paid_at: "2026-11-08T02:00:00Z" },
];

describe("buildPeriodLedger", () => {
  it("V01: lọc 08/11–21/11 tự tính nợ cũ, tổng phải thanh toán 96.530.000", () => {
    const ledger = buildPeriodLedger({
      orders: F1_ORDERS,
      payments: F1_PAYMENTS,
      fromDate: "2026-11-08",
      toDate: "2026-11-21",
    });

    expect(ledger.openingDebt).toBe(82_887_700);
    expect(ledger.periodPurchase).toBe(76_530_000);
    expect(ledger.periodPaidImmediate).toBe(0);
    expect(ledger.periodPayments.map((p) => p.id)).toEqual(["p2"]);
    expect(ledger.closingDebt).toBe(96_530_000);
  });

  it("V02: không lọc → nợ cũ 0, tổng = Σ đơn − Σ trả", () => {
    const ledger = buildPeriodLedger({
      orders: F1_ORDERS,
      payments: F1_PAYMENTS,
      fromDate: null,
      toDate: null,
    });

    expect(ledger.openingDebt).toBe(0);
    expect(ledger.periodPurchase).toBe(359_417_700);
    expect(ledger.periodPayments).toHaveLength(2);
    expect(ledger.closingDebt).toBe(96_530_000);
  });

  it("V03: lần trả trước kỳ vào nợ cũ, không nằm trong danh sách trả", () => {
    const ledger = buildPeriodLedger({
      orders: F1_ORDERS,
      payments: F1_PAYMENTS,
      fromDate: "2026-09-21",
      toDate: "2026-11-21",
    });

    expect(ledger.openingDebt).toBe(-200_000_000);
    expect(ledger.periodPayments.map((p) => p.id)).toEqual(["p2"]);
    expect(ledger.closingDebt).toBe(96_530_000);
  });

  it("V04: lần trả đúng ngày fromDate tính trong kỳ", () => {
    const ledger = buildPeriodLedger({
      orders: [],
      payments: [{ id: "p", amount: 5, paid_at: "2026-11-08T05:00:00Z" }],
      fromDate: "2026-11-08",
      toDate: null,
    });

    expect(ledger.openingDebt).toBe(0);
    expect(ledger.periodPayments.map((p) => p.id)).toEqual(["p"]);
  });

  it("V05: paid_at 17:30 UTC 07/11 là 00:30 ngày 08/11 giờ VN → trong kỳ", () => {
    const ledger = buildPeriodLedger({
      orders: [],
      payments: [{ id: "p", amount: 5, paid_at: "2026-11-07T17:30:00Z" }],
      fromDate: "2026-11-08",
      toDate: null,
    });

    expect(ledger.openingDebt).toBe(0);
    expect(ledger.periodPayments).toHaveLength(1);
  });

  it("V06: trả ngay khi mua trừ đúng phía nợ cũ / trong kỳ", () => {
    const ledger = buildPeriodLedger({
      orders: [
        { business_date: "2026-11-01", total_amount: 1_000, paid_amount: 300 },
        { business_date: "2026-11-10", total_amount: 2_000, paid_amount: 500 },
      ],
      payments: [],
      fromDate: "2026-11-08",
      toDate: null,
    });

    expect(ledger.openingDebt).toBe(700);
    expect(ledger.periodPurchase).toBe(2_000);
    expect(ledger.periodPaidImmediate).toBe(500);
    expect(ledger.closingDebt).toBe(2_200);
  });

  it("V07: đơn và lần trả sau toDate không tính", () => {
    const ledger = buildPeriodLedger({
      orders: [
        { business_date: "2026-11-10", total_amount: 1_000, paid_amount: 0 },
        { business_date: "2026-11-22", total_amount: 9_000, paid_amount: 0 },
      ],
      payments: [{ id: "late", amount: 400, paid_at: "2026-11-22T03:00:00Z" }],
      fromDate: null,
      toDate: "2026-11-21",
    });

    expect(ledger.periodPurchase).toBe(1_000);
    expect(ledger.periodPayments).toHaveLength(0);
    expect(ledger.closingDebt).toBe(1_000);
  });

  it("V08: khách trả dư trước kỳ → nợ cũ âm, tổng đúng dấu", () => {
    const ledger = buildPeriodLedger({
      orders: [
        { business_date: "2026-11-01", total_amount: 1_000, paid_amount: 0 },
        { business_date: "2026-11-10", total_amount: 300, paid_amount: 0 },
      ],
      payments: [{ id: "p", amount: 1_500, paid_at: "2026-11-02T03:00:00Z" }],
      fromDate: "2026-11-08",
      toDate: null,
    });

    expect(ledger.openingDebt).toBe(-500);
    expect(ledger.closingDebt).toBe(-200);
  });

  it("V09: tiền null/NaN coi là 0, chuỗi hợp lệ là số", () => {
    const ledger = buildPeriodLedger({
      orders: [
        { business_date: "2026-11-10", total_amount: null, paid_amount: null },
        { business_date: "2026-11-10", total_amount: "1000.00", paid_amount: "abc" },
      ],
      payments: [{ id: "p", amount: Number.NaN, paid_at: "2026-11-10T03:00:00Z" }],
      fromDate: null,
      toDate: null,
    });

    expect(ledger.periodPurchase).toBe(1_000);
    expect(ledger.periodPaidImmediate).toBe(0);
    expect(ledger.closingDebt).toBe(1_000);
  });
});
