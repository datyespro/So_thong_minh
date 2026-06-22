import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettlementSummaryPanel } from "@/src/components/customers/purchase-history-table";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";

function summary(debtTotal: number): CustomerDebtSummary {
  return {
    totalPurchase: 22_584_000,
    paidImmediate: 0,
    paidLater: 22_584_000 - debtTotal,
    paidTotal: 22_584_000 - debtTotal,
    debtTotal,
    reconciles: true,
  };
}

describe("SettlementSummaryPanel (#31 — VĐ3 nợ âm)", () => {
  it("shows prepaid credit instead of a negative 'Còn nợ'", () => {
    const html = renderToStaticMarkup(
      createElement(SettlementSummaryPanel, {
        total: 22_584_000,
        summary: summary(-77_416_000),
        payments: [],
      }),
    );
    expect(html).toContain("= Khách trả trước");
    expect(html).toContain("77.416.000 đ");
    expect(html).toContain("text-paid");
    expect(html).not.toContain("Còn nợ");
    expect(html).not.toContain("-77");
    expect(html).not.toContain("−77");
  });

  it("keeps the outstanding-debt line for a positive balance", () => {
    const html = renderToStaticMarkup(
      createElement(SettlementSummaryPanel, {
        total: 22_584_000,
        summary: summary(600_000),
        payments: [],
      }),
    );
    expect(html).toContain("= Còn nợ");
    expect(html).toContain("600.000 đ");
    expect(html).toContain("text-debt");
    expect(html).not.toContain("Khách trả trước");
  });
});
