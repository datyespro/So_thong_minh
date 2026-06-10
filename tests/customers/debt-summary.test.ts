import { describe, expect, it } from "vitest";
import { buildCustomerDebtSummary } from "@/src/lib/customers/debt-summary";

describe("buildCustomerDebtSummary", () => {
  it("sums purchases, immediate payments, later payments, and reconciles debt", () => {
    const summary = buildCustomerDebtSummary({
      orders: [
        { total_amount: 500000, paid_amount: 100000 },
        { total_amount: "300000", paid_amount: "50000" },
      ],
      payments: [{ amount: 150000 }],
      debtTotal: 500000,
    });

    expect(summary).toEqual({
      totalPurchase: 800000,
      paidImmediate: 150000,
      paidLater: 150000,
      paidTotal: 300000,
      debtTotal: 500000,
      reconciles: true,
    });
  });

  it("handles no immediate payments", () => {
    const summary = buildCustomerDebtSummary({
      orders: [
        { total_amount: 800000, paid_amount: 0 },
      ],
      payments: [{ amount: 200000 }],
      debtTotal: 600000,
    });

    expect(summary.paidImmediate).toBe(0);
    expect(summary.paidLater).toBe(200000);
    expect(summary.paidTotal).toBe(200000);
    expect(summary.reconciles).toBe(true);
  });

  it("handles customers without later payments", () => {
    const summary = buildCustomerDebtSummary({
      orders: [
        { total_amount: 400000, paid_amount: 0 },
        { total_amount: 250000, paid_amount: 0 },
      ],
      payments: [],
      debtTotal: 650000,
    });

    expect(summary.paidLater).toBe(0);
    expect(summary.paidTotal).toBe(0);
    expect(summary.reconciles).toBe(true);
  });

  it("marks the summary as not reconciled when denorm debt differs", () => {
    const summary = buildCustomerDebtSummary({
      orders: [{ total_amount: 800000, paid_amount: 0 }],
      payments: [{ amount: 200000 }],
      debtTotal: 500000,
    });

    expect(summary.totalPurchase - summary.paidTotal).toBe(600000);
    expect(summary.debtTotal).toBe(500000);
    expect(summary.reconciles).toBe(false);
  });
});
