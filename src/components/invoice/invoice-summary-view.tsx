import Link from "next/link";
import type { CSSProperties } from "react";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { vietnameseAmountInWords } from "@/src/lib/format/number-to-words-vi";
import type { ShopSettings } from "@/src/lib/shop/get-shop-settings";
import { earliestBusinessDate } from "@/src/lib/customers/reconciliation-period";

type CustomerPaymentRow = {
  id: string;
  amount: number | string | null;
  paid_at: string | null;
};

type InvoiceSummaryViewProps = Readonly<{
  shopSettings: ShopSettings;
  customerName: string;
  customerPhone: string | null;
  rows: CustomerPurchaseHistoryRow[];
  historyTotal: number;
  debtSummary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
  printDate: string;
}>;

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

function formatPaymentDay(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = dayjs(value);

  return parsed.isValid()
    ? parsed.tz(APP_TIME_ZONE).format("DD/MM/YYYY")
    : "—";
}

function paymentSortTime(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.valueOf() : Number.POSITIVE_INFINITY;
}

function sortedPaymentsByPaidAt(payments: CustomerPaymentRow[]) {
  return [...payments].sort((left, right) => {
    const timeDiff =
      paymentSortTime(left.paid_at) - paymentSortTime(right.paid_at);

    return timeDiff === 0 ? left.id.localeCompare(right.id) : timeDiff;
  });
}

const pageStyle = {
  background: "#ffffff",
  color: "#111111",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: "12px",
  lineHeight: 1.45,
  margin: "0 auto",
  maxWidth: "190mm",
  padding: "0",
} satisfies CSSProperties;

const tableCellStyle = {
  border: "1px solid #333333",
  padding: "5px 6px",
  verticalAlign: "top",
} satisfies CSSProperties;

const numericCellStyle = {
  ...tableCellStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
} satisfies CSSProperties;

export function InvoiceSummaryView({
  shopSettings,
  customerName,
  customerPhone,
  rows,
  historyTotal,
  debtSummary,
  payments,
  printDate,
}: InvoiceSummaryViewProps) {
  const shopName = shopSettings.shop_name.trim();
  const phone = shopSettings.phone.trim();
  const address = shopSettings.address.trim();
  const orderedPayments = sortedPaymentsByPaidAt(payments);
  const fromDate = earliestBusinessDate(rows);

  return (
    <article className="invoice-summary-view" style={pageStyle}>
      <header
        style={{
          borderBottom: "2px solid #2a5a8c",
          marginBottom: "14px",
          paddingBottom: "10px",
        }}
      >
        {shopName ? (
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "0.03em",
              margin: "0 0 6px",
              textTransform: "uppercase",
            }}
          >
            {shopName}
          </h1>
        ) : (
          <p
            style={{
              border: "1px solid #777777",
              fontWeight: 700,
              margin: "0 0 8px",
              padding: "6px 8px",
            }}
          >
            Chưa cài đặt thông tin cửa hàng.{" "}
            <Link href="/settings" style={{ color: "#111111", textDecoration: "underline" }}>
              Cài đặt cửa hàng
            </Link>
          </p>
        )}
        <p style={{ margin: 0 }}>
          {phone ? `SĐT: ${phone}` : "SĐT: —"}
          {" · "}
          {address ? `Địa chỉ: ${address}` : "Địa chỉ: —"}
        </p>
      </header>

      <section
        style={{
          borderBottom: "1px solid #444444",
          marginBottom: "12px",
          paddingBottom: "10px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 800,
            margin: "0 0 8px",
            textTransform: "uppercase",
          }}
        >
          Bảng đối chiếu công nợ
        </h2>
        <p style={{ margin: "0 0 3px" }}>
          <strong>Khách hàng:</strong> {customerName}
          {customerPhone ? ` · SĐT: ${customerPhone}` : ""}
        </p>
        <p style={{ margin: "0 0 3px" }}>
          {fromDate
            ? `Kỳ đối chiếu: từ ${formatDate(fromDate)} đến ${printDate}`
            : `Kỳ đối chiếu: đến ${printDate}`}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Ngày in:</strong> {printDate}
        </p>
      </section>

      <table
        style={{
          borderCollapse: "collapse",
          tableLayout: "fixed",
          width: "100%",
        }}
      >
        <thead
          style={{
            backgroundColor: "#eef1f4",
            color: "#111111",
            fontWeight: 700,
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        >
          <tr>
            <th scope="col" style={{ ...tableCellStyle, width: "22mm" }}>
              Ngày
            </th>
            <th scope="col" style={tableCellStyle}>
              Tên hàng hóa
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "18mm" }}>
              SL
            </th>
            <th scope="col" style={{ ...tableCellStyle, width: "20mm" }}>
              ĐVT
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "28mm" }}>
              Đơn giá
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "30mm" }}>
              Thành tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row, index) => {
              const isEven = (index + 1) % 2 === 0;
              const rowStyle: CSSProperties | undefined = isEven
                ? {
                    backgroundColor: "#f7f8fa",
                    printColorAdjust: "exact",
                    WebkitPrintColorAdjust: "exact",
                  }
                : undefined;

              return (
                <tr
                  key={`${row.order_id}-${row.sort_order ?? "null"}-${index}`}
                  style={rowStyle}
                >
                  <td style={tableCellStyle}>{formatDate(row.business_date)}</td>
                  <td style={tableCellStyle}>{row.product_name_snapshot}</td>
                  <td style={numericCellStyle}>{String(row.quantity)}</td>
                  <td style={tableCellStyle}>{row.unit_snapshot || "—"}</td>
                  <td style={numericCellStyle}>{money(row.unit_price)}</td>
                  <td style={numericCellStyle}>{money(row.line_total)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={6} style={{ ...tableCellStyle, textAlign: "center" }}>
                Chưa có lịch sử mua.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <section
        style={{
          borderBottom: "1px solid #444444",
          borderTop: "2px solid #2a5a8c",
          marginTop: "12px",
          paddingBottom: "12px",
          paddingTop: "12px",
        }}
      >
        <div style={{ marginLeft: "auto", maxWidth: "82mm" }}>
          <SummaryLine label="Nợ đầu kỳ" value="0 đ" />
          <SummaryLine label="Tổng mua trong kỳ" value={money(historyTotal)} />
          {orderedPayments.map((payment) => (
            <SummaryLine
              key={payment.id}
              label={`− Trả ${formatPaymentDay(payment.paid_at)}`}
              value={money(payment.amount)}
            />
          ))}
          {debtSummary.paidImmediate > 0 ? (
            <SummaryLine
              label="− Trả ngay khi mua"
              value={money(debtSummary.paidImmediate)}
            />
          ) : null}
          <div style={{ borderTop: "1px solid #111111", marginTop: "6px", paddingTop: "6px" }}>
            <SummaryLine
              bold
              label="= Còn nợ cuối kỳ"
              value={money(debtSummary.debtTotal)}
            />
          </div>
          <div style={{ marginTop: "6px", fontStyle: "italic", textAlign: "right" }}>
            Bằng chữ: {vietnameseAmountInWords(debtSummary.debtTotal)}
          </div>
        </div>
      </section>

      <p style={{ marginTop: "10px", marginBottom: 0, textAlign: "left" }}>
        Hai bên thống nhất số liệu công nợ nêu trên là đúng và đầy đủ.
      </p>

      <footer
        style={{
          display: "grid",
          gap: "24mm",
          gridTemplateColumns: "1fr 1fr",
          marginTop: "18mm",
          paddingBottom: "25mm",
          textAlign: "center",
        }}
      >
        <SignatureBlock label="XÁC NHẬN CỦA KHÁCH HÀNG" />
        <SignatureBlock label="ĐẠI DIỆN CỬA HÀNG" />
      </footer>
    </article>
  );
}

function SummaryLine({
  label,
  value,
  bold = false,
}: Readonly<{
  label: string;
  value: string;
  bold?: boolean;
}>) {
  return (
    <div
      style={{
        display: "grid",
        fontWeight: bold ? 800 : 500,
        gap: "10px",
        gridTemplateColumns: "1fr auto",
        marginTop: "4px",
      }}
    >
      <span>{label}</span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{value}</span>
    </div>
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
