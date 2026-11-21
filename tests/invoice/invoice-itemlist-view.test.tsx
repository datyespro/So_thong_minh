import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceItemListView } from "@/src/components/invoice/invoice-itemlist-view";
import type { HistoryFilter } from "@/src/lib/customers/filter-history";
import { filterHistoryRows } from "@/src/lib/customers/filter-history";

const baseProps = {
  shopSettings: { shop_name: "Cửa hàng A", phone: "0900", address: "Số 1" },
  customerName: "Khách 1",
  customerPhone: null,
  rows: [],
  orders: [],
  payments: [],
  total: 0,
  printDate: "23/06/2026",
};

function render(filter: HistoryFilter): string {
  return renderToStaticMarkup(
    createElement(InvoiceItemListView, { ...baseProps, filter }),
  );
}

describe("InvoiceItemListView — header liệt kê nhóm đang lọc (TIP-PRINT-NHOM)", () => {
  it("có categoryNames -> render dòng 'Nhóm:' với danh sách nhóm", () => {
    const html = render({
      fromDate: null,
      toDate: null,
      productNames: null,
      categoryNames: ["Xi măng", "Gạch"],
    });

    expect(html).toContain("Nhóm:");
    expect(html).toContain("Xi măng, Gạch");
  });

  it("categoryNames null -> KHÔNG render dòng 'Nhóm:'", () => {
    const html = render({
      fromDate: null,
      toDate: null,
      productNames: null,
      categoryNames: null,
    });

    expect(html).not.toContain("Nhóm:");
  });

  it("categoryNames rỗng -> KHÔNG render dòng 'Nhóm:'", () => {
    const html = render({
      fromDate: null,
      toDate: null,
      productNames: null,
      categoryNames: [],
    });

    expect(html).not.toContain("Nhóm:");
  });
});

const orders = [
  { business_date: "2026-09-21", total_amount: 182_887_700, paid_amount: 0 },
  { business_date: "2026-10-15", total_amount: 100_000_000, paid_amount: 0 },
  { business_date: "2026-11-08", total_amount: 40_000_000, paid_amount: 0 },
  { business_date: "2026-11-21", total_amount: 36_530_000, paid_amount: 0 },
];
const payments = [
  { id: "p1", paid_at: "2026-09-14T03:00:00Z", amount: 200_000_000 },
  { id: "p2", paid_at: "2026-11-08T02:00:00Z", amount: 62_887_700, scope_label: "Xi măng" },
];
const rows = orders.map((order, index) => ({
  order_id: `o${index}`, product_id: null, business_date: order.business_date,
  product_name_snapshot: "Xi măng", quantity: 1, unit_snapshot: "bao",
  unit_price: order.total_amount, line_total: order.total_amount,
  sort_order: 0, category_name: "VLXD",
}));
const period: HistoryFilter = {
  fromDate: "2026-11-08", toDate: "2026-11-21", productNames: null, categoryNames: null,
};

function periodProps(filter = period) {
  const filtered = filterHistoryRows(rows, filter);
  return { ...baseProps, orders, payments, rows: filtered.rows, total: filtered.total, filter };
}

describe("InvoiceItemListView — nợ cũ theo kỳ (nhóm 3)", () => {
  it("V13: F1 in nợ cũ trên bảng, tiền hàng/trả/tổng và bằng chữ đúng", () => {
    const html = renderToStaticMarkup(<InvoiceItemListView {...periodProps()} />);
    expect(html).toContain("Nợ cũ đến 07/11/2026");
    expect(html).toContain("82.887.700 đ");
    expect(html.indexOf("Nợ cũ đến")).toBeLessThan(html.indexOf("<table"));
    expect(html).toContain("Tiền hàng trong kỳ");
    expect(html).toContain("76.530.000 đ");
    expect(html).toContain("− Đã trả 08/11/2026 (Xi măng)");
    expect(html).toContain("62.887.700 đ");
    expect(html).not.toContain("− Đã trả 14/09/2026");
    expect(html).toContain("TỔNG PHẢI THANH TOÁN");
    expect(html).toContain("96.530.000 đ");
    expect(html).toContain("Bằng chữ: Chín mươi sáu triệu năm trăm ba mươi nghìn đồng");
    expect(html).toContain("break-inside:avoid");
    expect(html).toContain("page-break-inside:avoid");
  });

  it.each([
    ["V14: chỉ toDate", { ...period, fromDate: null }],
    ["V15: ngày + nhóm", { ...period, categoryNames: ["VLXD"] }],
    ["lọc món", { ...period, productNames: ["Xi măng"] }],
    ["không lọc", { ...period, fromDate: null, toDate: null }],
  ])("%s giữ Tổng cộng/bằng chữ cũ", (_name, filter) => {
    const props = periodProps(filter);
    const html = renderToStaticMarkup(<InvoiceItemListView {...props} />);
    expect(html).toContain("Tổng cộng");
    expect(html).not.toContain("Nợ cũ đến");
    expect(html).not.toContain("Tiền hàng trong kỳ");
    expect(html).not.toContain("− Đã trả");
    expect(html).not.toContain("TỔNG PHẢI THANH TOÁN");
    const expected = filter.fromDate === null ? "359.417.700 đ" : "76.530.000 đ";
    expect(html).toContain(expected);
    expect(html).toContain(filter.fromDate === null
      ? "Ba trăm năm mươi chín triệu bốn trăm mười bảy nghìn bảy trăm đồng"
      : "Bảy mươi sáu triệu năm trăm ba mươi nghìn đồng");
  });

  it("V16: nợ cũ và tổng âm dùng số/bằng chữ dương, có nhãn trả trước", () => {
    const html = renderToStaticMarkup(<InvoiceItemListView {...periodProps()}
      orders={[]} rows={[]} total={0}
      payments={[{ id: "p", amount: 200_000, paid_at: "2026-11-01T03:00:00Z" }]}
    />);
    expect(html).toContain("Nợ cũ đến 07/11/2026 (Khách trả trước)");
    expect(html).toContain("= Khách trả trước");
    expect(html).toContain("200.000 đ");
    expect(html).toContain("Bằng chữ: Hai trăm nghìn đồng");
    expect(html).not.toContain("-200.000");
    expect(html).not.toContain("Âm");
  });

  it("không nợ cũ và không trả thì giữ Tổng cộng", () => {
    const html = renderToStaticMarkup(<InvoiceItemListView {...periodProps()}
      orders={orders.slice(2)} payments={[]}
    />);
    expect(html).toContain("Tổng cộng");
    expect(html).not.toContain("Nợ cũ đến");
  });

  it("nợ cũ bằng 0 nhưng trả trong kỳ thì vẫn hiện, sắp ngày tăng và đổi UTC→VN", () => {
    const html = renderToStaticMarkup(<InvoiceItemListView {...periodProps()}
      orders={orders.slice(2)}
      payments={[
        { id: "b", amount: 20, paid_at: "2026-11-09T03:00:00Z", scope_label: "Xi măng" },
        { id: "a", amount: 10, paid_at: "2026-11-07T17:30:00Z" },
        { id: "c", amount: 999, paid_at: "2026-11-22T03:00:00Z" },
      ]}
    />);
    expect(html).toContain("Nợ cũ đến 07/11/2026");
    expect(html.indexOf("− Đã trả 08/11/2026")).toBeLessThan(html.indexOf("− Đã trả 09/11/2026 (Xi măng)"));
    expect(html).not.toContain("− Đã trả 22/11/2026");
    expect(html).toContain("76.529.970 đ");
  });

  it("chỉ trả ngay trong kỳ cũng bật khối tổng, mảng món/nhóm rỗng không chặn", () => {
    const props = periodProps({ ...period, categoryNames: [], productNames: [] });
    const html = renderToStaticMarkup(<InvoiceItemListView {...props}
      orders={[{ business_date: "2026-11-08", total_amount: 76_530_000, paid_amount: 300_000 }]}
      payments={[]}
    />);
    expect(html).toContain("− Trả ngay khi mua");
    expect(html).toContain("300.000 đ");
    expect(html).toContain("76.230.000 đ");
  });

  it("dừng render khi tiền hàng theo đơn lệch tổng các dòng in", () => {
    expect(() => renderToStaticMarkup(<InvoiceItemListView {...periodProps()} total={1} />))
      .toThrow(/Tiền hàng trong kỳ.*76530000.*1/);
  });
});
