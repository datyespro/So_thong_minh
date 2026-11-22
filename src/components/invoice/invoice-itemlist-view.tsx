import Link from "next/link";
import type { CSSProperties } from "react";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";
import { dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { vietnameseAmountInWords } from "@/src/lib/format/number-to-words-vi";
import { formatUnitDisplay } from "@/src/lib/format/unit";
import type { ShopSettings } from "@/src/lib/shop/get-shop-settings";
import type { HistoryFilter } from "@/src/lib/customers/filter-history";
import {
  filteredPeriodLedger,
  paymentBusinessDate,
  type PeriodLedgerOrder,
  type PeriodLedgerPayment,
} from "@/src/lib/customers/reconciliation-period";
import { reconciliationPrintFinalLine } from "@/src/lib/customers/debt-standing";
import { paymentScopeSuffix } from "@/src/lib/customers/payment-scope-label";

type InvoiceItemListViewProps = Readonly<{
  shopSettings: ShopSettings;
  customerName: string;
  customerPhone: string | null;
  rows: CustomerPurchaseHistoryRow[];
  orders: PeriodLedgerOrder[];
  payments: (PeriodLedgerPayment & { id: string; scope_label?: string | null })[];
  total: number;
  printDate: string;
  filter: HistoryFilter;
}>;

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

const pageStyle = {
  background: "#ffffff",
  color: "#111111",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: "13px",
  lineHeight: 1.3,
  margin: "0 auto",
  maxWidth: "190mm",
  padding: "0",
} satisfies CSSProperties;

const tableCellStyle = {
  border: "1px solid #333333",
  padding: "3px 4px",
  overflowWrap: "anywhere",
  verticalAlign: "top",
} satisfies CSSProperties;

const centerCellStyle = {
  ...tableCellStyle,
  textAlign: "center",
} satisfies CSSProperties;

const nameCellStyle = {
  ...tableCellStyle,
  paddingLeft: "6px",
  textAlign: "left",
} satisfies CSSProperties;

const quantityCellStyle = {
  ...tableCellStyle,
  textAlign: "center",
  whiteSpace: "nowrap",
  overflowWrap: "normal",
} satisfies CSSProperties;

const numericCellStyle = {
  ...tableCellStyle,
  paddingRight: "8px",
  textAlign: "right",
  whiteSpace: "nowrap",
  overflowWrap: "normal",
} satisfies CSSProperties;

const summaryLineStyle = {
  display: "grid", fontWeight: 800, gap: "10px",
  gridTemplateColumns: "1fr auto", marginTop: "4px",
} satisfies CSSProperties;

const ledgerLineStyle = { ...summaryLineStyle, fontWeight: 400 } satisfies CSSProperties;

const ledgerTotalStyle = {
  ...summaryLineStyle,
  borderTop: "1px solid #111111",
  marginTop: "6px",
  paddingTop: "6px",
} satisfies CSSProperties;

export function InvoiceItemListView({
  shopSettings,
  customerName,
  customerPhone,
  rows,
  orders,
  payments,
  total,
  printDate,
  filter,
}: InvoiceItemListViewProps) {
  const shopName = shopSettings.shop_name.trim();
  const phone = shopSettings.phone.trim();
  const address = shopSettings.address.trim();
  const { ledger, show: showPeriodLedger } = filteredPeriodLedger({
    orders, payments, filter, linesTotal: total,
  });

  const finalLine = reconciliationPrintFinalLine(ledger.closingDebt);
  const openingLine = reconciliationPrintFinalLine(ledger.openingDebt);
  const openingLabel = `${ledger.openingDebt < 0 ? "Khách trả trước" : "Nợ cũ"} (trước ${formatDate(filter.fromDate)})`;
  const orderedPayments = [...ledger.periodPayments].sort((left, right) => {
    const leftTime = paymentBusinessDate(left.paid_at) ? dayjs(left.paid_at).valueOf() : Infinity;
    const rightTime = paymentBusinessDate(right.paid_at) ? dayjs(right.paid_at).valueOf() : Infinity;
    return leftTime - rightTime || left.id.localeCompare(right.id);
  });
  const periodLines = [
    { label: `${ledger.openingDebt < 0 ? "− " : ""}${openingLabel}`, amount: openingLine.amount },
    { label: "+ Tiền hàng trong kỳ", amount: ledger.periodPurchase },
    ...orderedPayments.map((payment) => ({
      label: `− Đã trả ${formatDate(paymentBusinessDate(payment.paid_at))}${paymentScopeSuffix(payment.scope_label)}`,
      amount: payment.amount,
    })),
    ...(ledger.periodPaidImmediate > 0
      ? [{ label: "− Trả ngay khi mua", amount: ledger.periodPaidImmediate }]
      : []),
  ];
  const totalLabel = ledger.closingDebt < 0 ? finalLine.label : "TỔNG PHẢI THANH TOÁN";

  return (
    <article className="invoice-document invoice-itemlist-view" style={pageStyle}>
      <header style={{ borderBottom: "2px solid #2a5a8c", marginBottom: "14px", paddingBottom: "10px" }}>
        {shopName ? (
          <h1 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.03em", margin: "0 0 6px", textTransform: "uppercase", textWrap: "balance" }}>
            {shopName}
          </h1>
        ) : (
          <p style={{ border: "1px solid #777777", fontWeight: 700, margin: "0 0 8px", padding: "6px 8px" }}>
            Chưa cài đặt thông tin cửa hàng.{" "}
            <Link href="/settings" style={{ color: "#111111", textDecoration: "underline" }}>
              Cài đặt cửa hàng
            </Link>
          </p>
        )}
        <p style={{ margin: 0, fontSize: "12px" }}>
          {phone ? `SĐT: ${phone}` : "SĐT: —"}
          {" · "}
          {address ? `Địa chỉ: ${address}` : "Địa chỉ: —"}
        </p>
      </header>

      <section className="invoice-metadata" style={{ marginBottom: "12px", paddingBottom: "10px", textAlign: "center", fontSize: "13px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 8px", textTransform: "uppercase" }}>
          BẢNG KÊ HÀNG HÓA
        </h2>
        <p style={{ margin: "0 0 3px" }}>
          <strong>Khách hàng:</strong> {customerName}
          {customerPhone ? ` · SĐT: ${customerPhone}` : ""}
          {" · "}
          <strong>Ngày in:</strong> {printDate}
        </p>

        {(filter.fromDate || filter.toDate) && (
          <p style={{ margin: "0 0 3px" }}>
            <strong>Kỳ:</strong> từ {formatDate(filter.fromDate)} đến {formatDate(filter.toDate)}
          </p>
        )}
        {filter.categoryNames && filter.categoryNames.length > 0 && (
          <p style={{ margin: "0 0 3px" }}>
            <strong>Nhóm:</strong> {filter.categoryNames.join(", ")}
          </p>
        )}
        {filter.productNames && filter.productNames.length > 0 && (
          <p style={{ margin: "0 0 3px" }}>
            <strong>Mặt hàng:</strong> {filter.productNames.join(", ")}
          </p>
        )}

      </section>

      {showPeriodLedger ? (
        <div className="invoice-summary" style={{ marginBottom: "12px" }}>
          <div style={summaryLineStyle}>
            <span>{openingLabel}</span>
            <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {money(openingLine.amount)}
            </span>
          </div>
        </div>
      ) : null}

      <table style={{ borderCollapse: "collapse",
          fontSize: "10.5px", tableLayout: "fixed", width: "100%" }}>
        <thead style={{ backgroundColor: "#eef1f4", color: "#111111", fontWeight: 700, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <tr>
            <th scope="col" style={{ ...centerCellStyle, width: "13%" }}>Ngày</th>
            <th scope="col" style={{ ...nameCellStyle, width: "30%" }}>Tên hàng hóa</th>
            <th scope="col" style={{ ...quantityCellStyle, width: "10%" }}>SL</th>
            <th scope="col" style={{ ...centerCellStyle, width: "9%" }}>ĐVT</th>
            <th scope="col" style={{ ...numericCellStyle, width: "19%" }}>Đơn giá</th>
            <th scope="col" style={{ ...numericCellStyle, width: "19%" }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => {
              const isEven = (index + 1) % 2 === 0;
              const rowStyle: CSSProperties | undefined = isEven
                ? { backgroundColor: "#f7f8fa", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }
                : undefined;

              return (
                <tr key={`${row.order_id}-${row.sort_order ?? "null"}-${index}`} style={rowStyle}>
                  <td style={centerCellStyle}>{formatDate(row.business_date)}</td>
                  <td style={nameCellStyle}>{row.product_name_snapshot}</td>
                  <td style={quantityCellStyle}>{String(row.quantity)}</td>
                  <td style={centerCellStyle}>{formatUnitDisplay(row.unit_snapshot) || "—"}</td>
                  <td style={numericCellStyle}>{money(row.unit_price)}</td>
                  <td style={numericCellStyle}>{money(row.line_total)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} style={{ ...tableCellStyle, textAlign: "center" }}>
                Không có dòng nào khớp bộ lọc.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section className="invoice-summary" style={{ fontSize: "14px", marginTop: "12px", paddingBottom: "12px", paddingTop: "12px", breakInside: "avoid", pageBreakInside: "avoid" }}>
        <div style={{ marginLeft: "auto", maxWidth: showPeriodLedger ? "130mm" : "82mm" }}>
          {showPeriodLedger ? (
            <>
              {periodLines.map((line, index) => (
                <div key={index} style={ledgerLineStyle}>
                  <span>{line.label}</span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(line.amount)}</span>
                </div>
              ))}
              <div style={ledgerTotalStyle}>
                <span>{totalLabel}</span>
                <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(finalLine.amount)}</span>
              </div>
            </>
          ) : (
            <div style={summaryLineStyle}>
              <span>Tổng cộng</span>
              <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(total)}</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: "6px", fontStyle: "italic", textAlign: "left", fontSize: "12px", width: "100%", overflowWrap: "normal" }}>
          Bằng chữ: {showPeriodLedger ? finalLine.words : vietnameseAmountInWords(total)}
        </div>
        {showPeriodLedger && finalLine.note ? (
          <div style={{ marginTop: "4px", fontStyle: "italic", fontSize: "12px" }}>{finalLine.note}</div>
        ) : null}
      </section>

      <footer style={{ display: "grid", gap: "24mm", gridTemplateColumns: "1fr 1fr", marginTop: "10mm", paddingBottom: "20mm", textAlign: "center", fontSize: "12px" }}>
        <SignatureBlock label="XÁC NHẬN CỦA KHÁCH HÀNG" />
        <SignatureBlock label="ĐẠI DIỆN CỬA HÀNG" />
      </footer>
    </article>
  );
}

function SignatureBlock({ label }: Readonly<{ label: string }>) {
  return (
    <div>
      <p style={{ fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ margin: "5px 0 0" }}>(Ký, ghi rõ họ tên)</p>
    </div>
  );
}
