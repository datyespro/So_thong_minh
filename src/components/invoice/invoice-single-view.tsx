import Link from "next/link";
import type { CSSProperties } from "react";
import type { GroupedOrder } from "@/src/lib/customers/group-orders";
import { dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import type { ShopSettings } from "@/src/lib/shop/get-shop-settings";

type InvoiceSingleViewProps = Readonly<{
  shopSettings: ShopSettings;
  customerName: string;
  customerPhone: string | null;
  order: GroupedOrder;
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

export function InvoiceSingleView({
  shopSettings,
  customerName,
  customerPhone,
  order,
  printDate,
}: InvoiceSingleViewProps) {
  const shopName = shopSettings.shop_name.trim();
  const phone = shopSettings.phone.trim();
  const address = shopSettings.address.trim();

  return (
    <article className="invoice-single-view" style={pageStyle}>
      <header
        style={{
          borderBottom: "2px solid #111111",
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
          Hóa đơn bán hàng
        </h2>
        <p style={{ margin: "0 0 3px" }}>
          <strong>Khách hàng:</strong> {customerName}
          {customerPhone ? ` · SĐT: ${customerPhone}` : ""}
          {" · "}
          <strong>Ngày:</strong> {formatDate(order.business_date)}
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
        <thead>
          <tr>
            <th scope="col" style={{ ...numericCellStyle, width: "14mm" }}>
              STT
            </th>
            <th scope="col" style={tableCellStyle}>
              Mặt hàng
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "18mm" }}>
              SL
            </th>
            <th scope="col" style={{ ...tableCellStyle, width: "20mm" }}>
              ĐV
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "30mm" }}>
              Giá
            </th>
            <th scope="col" style={{ ...numericCellStyle, width: "32mm" }}>
              TT
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={`${item.order_id}-${item.sort_order ?? "null"}-${index}`}>
              <td style={numericCellStyle}>{index + 1}</td>
              <td style={tableCellStyle}>{item.product_name_snapshot}</td>
              <td style={numericCellStyle}>{String(item.quantity)}</td>
              <td style={tableCellStyle}>{item.unit_snapshot || "—"}</td>
              <td style={numericCellStyle}>{money(item.unit_price)}</td>
              <td style={numericCellStyle}>{money(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section
        style={{
          borderBottom: "1px solid #444444",
          marginTop: "12px",
          paddingBottom: "12px",
        }}
      >
        <div style={{ marginLeft: "auto", maxWidth: "82mm" }}>
          <div
            style={{
              display: "grid",
              fontWeight: 800,
              gap: "10px",
              gridTemplateColumns: "1fr auto",
            }}
          >
            <span>Tổng cộng</span>
            <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              {money(order.total)}
            </span>
          </div>
        </div>
      </section>

      <footer
        style={{
          display: "grid",
          gap: "24mm",
          gridTemplateColumns: "1fr 1fr",
          marginTop: "18mm",
          textAlign: "center",
        }}
      >
        <SignatureBlock label="Chữ ký bên mua" />
        <SignatureBlock label="Chữ ký bên bán" />
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
