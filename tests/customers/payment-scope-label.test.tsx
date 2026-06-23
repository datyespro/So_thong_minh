import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { paymentScopeSuffix } from "@/src/lib/customers/payment-scope-label";
import { SettlementSummaryPanel } from "@/src/components/customers/purchase-history-table";
import { InvoiceSummaryView } from "@/src/components/invoice/invoice-summary-view";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";

const shopSettings = {
  shop_name: "Cửa hàng Test",
  phone: "0900000000",
  address: "123 Test",
};

// 16/04/2026 theo Asia/Ho_Chi_Minh (+7) từ mốc UTC 03:00.
const PAID_AT = "2026-04-16T03:00:00.000Z";

function summary(overrides: Partial<CustomerDebtSummary> = {}): CustomerDebtSummary {
  return {
    totalPurchase: 1000000,
    paidImmediate: 0,
    paidLater: 200000,
    paidTotal: 200000,
    debtTotal: 800000,
    reconciles: true,
    ...overrides,
  };
}

describe("paymentScopeSuffix", () => {
  it("cọc có nhãn → ' (tên)'", () => {
    expect(paymentScopeSuffix("Gạch")).toBe(" (Gạch)");
  });

  it("null → ''", () => {
    expect(paymentScopeSuffix(null)).toBe("");
  });

  it("undefined → ''", () => {
    expect(paymentScopeSuffix(undefined)).toBe("");
  });
});

describe("SettlementSummaryPanel — nhãn nhóm trên dòng '− Trả' (DC-5d)", () => {
  it("cọc có nhóm → '− Trả 16/04/2026 (Gạch)'", () => {
    const html = renderToStaticMarkup(
      <SettlementSummaryPanel
        total={1000000}
        summary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: "Gạch" }]}
      />,
    );

    expect(html).toContain("− Trả 16/04/2026 (Gạch)");
  });

  it("cọc không nhóm → chỉ '− Trả 16/04/2026', không ngoặc", () => {
    const html = renderToStaticMarkup(
      <SettlementSummaryPanel
        total={1000000}
        summary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: null }]}
      />,
    );

    expect(html).toContain("− Trả 16/04/2026");
    expect(html).not.toContain("− Trả 16/04/2026 (");
  });

  it("'= Còn nợ' giữ nguyên giá trị bất kể có/không nhãn nhóm", () => {
    const withScope = renderToStaticMarkup(
      <SettlementSummaryPanel
        total={1000000}
        summary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: "Gạch" }]}
      />,
    );
    const withoutScope = renderToStaticMarkup(
      <SettlementSummaryPanel
        total={1000000}
        summary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: null }]}
      />,
    );

    // 800.000 đ = Còn nợ — không đổi khi thêm chữ trong nhãn dòng.
    expect(withScope).toContain("800.000 đ");
    expect(withoutScope).toContain("800.000 đ");
  });
});

describe("InvoiceSummaryView — nhãn nhóm trên dòng '− Trả' (DC-5d, bản in/PDF)", () => {
  it("cọc có nhóm → '− Trả 16/04/2026 (Xi măng)'", () => {
    const html = renderToStaticMarkup(
      <InvoiceSummaryView
        shopSettings={shopSettings}
        customerName="anh Hùng"
        customerPhone={null}
        rows={[]}
        historyTotal={1000000}
        debtSummary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: "Xi măng" }]}
        printDate="20/06/2026"
      />,
    );

    expect(html).toContain("− Trả 16/04/2026 (Xi măng)");
    expect(html).toContain("= Còn nợ cuối kỳ");
  });

  it("orphan (nhóm xóa mềm) → scope_label null → không ngoặc", () => {
    const html = renderToStaticMarkup(
      <InvoiceSummaryView
        shopSettings={shopSettings}
        customerName="anh Hùng"
        customerPhone={null}
        rows={[]}
        historyTotal={1000000}
        debtSummary={summary()}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: null }]}
        printDate="20/06/2026"
      />,
    );

    expect(html).toContain("− Trả 16/04/2026");
    expect(html).not.toContain("− Trả 16/04/2026 (");
  });

  it("'− Trả ngay khi mua' không gắn nhóm (giữ nguyên)", () => {
    const html = renderToStaticMarkup(
      <InvoiceSummaryView
        shopSettings={shopSettings}
        customerName="anh Hùng"
        customerPhone={null}
        rows={[]}
        historyTotal={1000000}
        debtSummary={summary({ paidImmediate: 300000 })}
        payments={[{ id: "p1", amount: 200000, paid_at: PAID_AT, scope_label: "Xi măng" }]}
        printDate="20/06/2026"
      />,
    );

    expect(html).toContain("− Trả ngay khi mua");
    expect(html).not.toContain("− Trả ngay khi mua (");
  });
});
