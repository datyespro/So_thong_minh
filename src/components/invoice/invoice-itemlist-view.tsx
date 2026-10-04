import Link from "next/link";
import type { CSSProperties } from "react";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";
import { dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { vietnameseAmountInWords } from "@/src/lib/format/number-to-words-vi";
import { formatUnitDisplay } from "@/src/lib/format/unit";
import type { ShopSettings } from "@/src/lib/shop/get-shop-settings";
import type { HistoryFilter } from "@/src/lib/customers/filter-history";

type InvoiceItemListViewProps = Readonly<{
  shopSettings: ShopSettings;
  customerName: string;
  customerPhone: string | null;
  rows: CustomerPurchaseHistoryRow[];
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
  fontSize: "20px",
  lineHeight: 1.45,
  margin: "0 auto",
  maxWidth: "190mm",
  padding: "0",
} satisfies CSSProperties;

const tableCellStyle = {
  border: "1px solid #333333",
  padding: "5px 3px",
  overflowWrap: "anywhere",
  verticalAlign: "top",
} satisfies CSSProperties;

const quantityCellStyle = {
  ...tableCellStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
  overflowWrap: "normal",
} satisfies CSSProperties;

const numericCellStyle = {
  ...tableCellStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
  overflowWrap: "normal",
} satisfies CSSProperties;

export function InvoiceItemListView({
  shopSettings,
  customerName,
  customerPhone,
  rows,
  total,
  printDate,
  filter,
}: InvoiceItemListViewProps) {
  const shopName = shopSettings.shop_name.trim();
  const phone = shopSettings.phone.trim();
  const address = shopSettings.address.trim();

  return (
    <article className="invoice-document invoice-itemlist-view" style={pageStyle}>
      <header style={{ borderBottom: "2px solid #2a5a8c", marginBottom: "14px", paddingBottom: "10px" }}>
        {shopName ? (
          <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.03em", margin: "0 0 6px", textTransform: "uppercase" }}>
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
        <p style={{ margin: 0, fontSize: "16px" }}>
          {phone ? `SĐT: ${phone}` : "SĐT: —"}
          {" · "}
          {address ? `Địa chỉ: ${address}` : "Địa chỉ: —"}
        </p>
      </header>

      <section className="invoice-metadata" style={{ marginBottom: "12px", paddingBottom: "10px", textAlign: "center", fontSize: "18px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 8px", textTransform: "uppercase" }}>
          BẢNG KÊ HÀNG HÓA
        </h2>
        <p style={{ margin: "0 0 3px" }}>
          <strong>Khách hàng:</strong> {customerName}
          {customerPhone ? ` · SĐT: ${customerPhone}` : ""}
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

        <p style={{ margin: 0 }}>
          <strong>Ngày in:</strong> {printDate}
        </p>
      </section>

      <table style={{ borderCollapse: "collapse",
          fontSize: "18px", tableLayout: "fixed", width: "100%" }}>
        <thead style={{ backgroundColor: "#eef1f4", color: "#111111", fontWeight: 700, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <tr>
            <th scope="col" style={{ ...tableCellStyle, width: "20%" }}>Ngày</th>
            <th scope="col" style={{ ...tableCellStyle, width: "13%" }}>Tên hàng hóa</th>
            <th scope="col" style={{ ...quantityCellStyle, width: "12%" }}>SL</th>
            <th scope="col" style={{ ...tableCellStyle, width: "9%" }}>ĐVT</th>
            <th scope="col" style={{ ...numericCellStyle, width: "23%" }}>Đơn giá</th>
            <th scope="col" style={{ ...numericCellStyle, width: "23%" }}>Thành tiền</th>
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
                  <td style={tableCellStyle}>{formatDate(row.business_date)}</td>
                  <td style={tableCellStyle}>{row.product_name_snapshot}</td>
                  <td style={quantityCellStyle}>{String(row.quantity)}</td>
                  <td style={tableCellStyle}>{formatUnitDisplay(row.unit_snapshot) || "—"}</td>
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

      <section className="invoice-summary" style={{ marginTop: "12px", paddingBottom: "12px", paddingTop: "12px" }}>
        <div style={{ marginLeft: "auto", maxWidth: "82mm" }}>
          <div style={{ display: "grid", fontWeight: 800, gap: "10px", gridTemplateColumns: "1fr auto", marginTop: "4px" }}>
            <span>Tổng cộng</span>
            <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(total)}</span>
          </div>
        </div>
        <div style={{ marginTop: "6px", fontStyle: "italic", textAlign: "left", fontSize: "18px", width: "100%", overflowWrap: "normal" }}>
          Bằng chữ: {vietnameseAmountInWords(total)}
        </div>
      </section>

      <footer style={{ display: "grid", gap: "24mm", gridTemplateColumns: "1fr 1fr", marginTop: "10mm", paddingBottom: "20mm", textAlign: "center", fontSize: "18px" }}>
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
