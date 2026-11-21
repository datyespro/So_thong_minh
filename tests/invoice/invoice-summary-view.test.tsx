import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceSummaryView } from "@/src/components/invoice/invoice-summary-view";
import { PrintableCustomerSection } from "@/src/components/invoice/printable-customer-section";
import { HistoryFilterProvider } from "@/src/components/customers/history-filter-provider";

const shopSettings = { shop_name: "Cửa hàng Test", phone: "", address: "" };
const orders = [
  { business_date: "2026-09-21", total_amount: 182_887_700, paid_amount: 0 },
  { business_date: "2026-10-15", total_amount: 100_000_000, paid_amount: 0 },
  { business_date: "2026-11-08", total_amount: 40_000_000, paid_amount: 0 },
  { business_date: "2026-11-21", total_amount: 36_530_000, paid_amount: 0 },
];
const payments = [
  { id: "p2", amount: 62_887_700, paid_at: "2026-11-08T02:00:00Z", scope_label: "Xi măng" },
  { id: "p1", amount: 200_000_000, paid_at: "2026-09-14T03:00:00Z" },
];
const props = {
  shopSettings, customerName: "Vinh+giang nghĩa", customerPhone: null,
  rows: [], orders, payments, printDate: "21/11/2026",
};

function renderSection(debtTotal: number) {
  return renderToStaticMarkup(
    <HistoryFilterProvider rows={[]}>
      <PrintableCustomerSection
        {...props}
        groupedOrders={[]}
        debtSummary={{
          totalPurchase: 359_417_700, paidImmediate: 0, paidLater: 262_887_700,
          paidTotal: 262_887_700, debtTotal, reconciles: debtTotal === 96_530_000,
        }}
      >
        <main>Nội dung trang khách</main>
      </PrintableCustomerSection>
    </HistoryFilterProvider>,
  );
}

describe("Bảng đối chiếu — nhóm 2", () => {
  it("V11: F1 lấy kỳ từ lần trả sớm nhất, các dòng và bằng chữ từ sổ chung", () => {
    const html = renderToStaticMarkup(<InvoiceSummaryView {...props} />);
    expect(html).toContain("Kỳ đối chiếu: từ 14/09/2026 đến 21/11/2026");
    expect(html).toContain("Nợ đầu kỳ</span><span style=\"text-align:right;white-space:nowrap\">0 đ");
    expect(html).toContain("359.417.700 đ");
    expect(html).toContain("62.887.700 đ");
    expect(html).toContain("− Trả 08/11/2026 (Xi măng)");
    expect(html.indexOf("− Trả 14/09/2026")).toBeLessThan(html.indexOf("− Trả 08/11/2026"));
    expect(html).toContain("= Còn nợ cuối kỳ");
    expect(html).toContain("96.530.000 đ");
    expect(html).toContain("Chín mươi sáu triệu năm trăm ba mươi nghìn đồng");
    const source = readFileSync("src/components/invoice/invoice-summary-view.tsx", "utf8");
    expect(source).not.toContain('value="0 đ"');
  });

  it("trả ngay lấy từ đơn và tổng âm dùng nhãn/cách đọc khách trả trước", () => {
    const html = renderToStaticMarkup(
      <InvoiceSummaryView {...props}
        orders={[{ business_date: "2026-11-08", total_amount: 1_000_000, paid_amount: 300_000 }]}
        payments={[{ id: "p", amount: 900_000, paid_at: "2026-11-08T03:00:00Z" }]}
      />,
    );
    expect(html).toContain("− Trả ngay khi mua");
    expect(html).toContain("300.000 đ");
    expect(html).toContain("= Khách trả trước");
    expect(html).toContain("200.000 đ");
    expect(html).toContain("Bằng chữ: Hai trăm nghìn đồng");
    expect(html).not.toContain("-200.000");
    expect(html).not.toContain("Âm");
  });

  it("V12 + S2: cảnh báo lệch nằm trước nội dung, ngoài vùng in/xuất, có cả hai số", () => {
    const html = renderSection(116_530_000);
    const alert = html.match(/<p[^>]*role="alert"[^>]*>[\s\S]*?<\/p>/)?.[0];
    expect(alert).toBeDefined();
    expect(alert).toContain("no-print");
    expect(alert).toContain('data-html2canvas-ignore="true"');
    expect(alert).toContain("mx-auto max-w-6xl");
    expect(alert).toContain("96.530.000 đ");
    expect(alert).toContain("116.530.000 đ");
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf("<main>"));
    const printArea = html.slice(html.indexOf('class="print-area print-only"'));
    expect(printArea).not.toContain('role="alert"');
    expect(printArea).not.toContain("116.530.000 đ");
    expect(printArea).toContain("96.530.000 đ");
    const css = readFileSync("src/styles/print.css", "utf8");
    expect(css).toMatch(/@media print[\s\S]*?\.no-print\s*\{\s*display: none !important;/);
  });

  it("V12: số khớp thì không hiện cảnh báo", () => {
    const html = renderSection(96_530_000);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Cảnh báo:");
    expect(html).toContain("96.530.000 đ");
  });
});
