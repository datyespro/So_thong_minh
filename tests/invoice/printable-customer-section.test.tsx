import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useHistoryFilter } from "@/src/components/customers/history-filter-provider";
import { filterHistoryRows, type HistoryFilter } from "@/src/lib/customers/filter-history";
import {
  InvoiceActionMenuItems,
  PrintableCustomerSection,
  POPOVER_GAP,
  resolvePopoverVerticalPlacement,
} from "@/src/components/invoice/printable-customer-section";

vi.mock("@/src/components/customers/history-filter-provider", () => ({
  useHistoryFilter: vi.fn(),
}));

describe("PrintableCustomerSection — nối dữ liệu bảng kê nhóm 3", () => {
  const orders = [
    { business_date: "2026-11-01", total_amount: 1000, paid_amount: 0 },
    { business_date: "2026-11-08", total_amount: 2000, paid_amount: 0 },
  ];
  const rows = orders.map((order, index) => ({
    order_id: `o${index}`, product_id: null, business_date: order.business_date,
    product_name_snapshot: "Xi măng", quantity: 1, unit_snapshot: "bao",
    unit_price: order.total_amount, line_total: order.total_amount, sort_order: 0, category_name: "VLXD",
  }));

  function renderSection(filter: HistoryFilter, isFiltered = true, periodPurchase = 2000) {
    const filtered = filterHistoryRows(rows, filter);
    vi.mocked(useHistoryFilter).mockReturnValue({
      filter, setFilter: vi.fn(), filteredRows: filtered.rows, filteredTotal: filtered.total,
      isFiltered, productNameOptions: [], categoryNameOptions: [], productCategoryIndex: new Map(),
    });
    return renderToStaticMarkup(<PrintableCustomerSection
      shopSettings={{ shop_name: "Cửa hàng", phone: "", address: "" }}
      customerName="Khách" customerPhone={null} rows={rows}
      orders={orders.map((order, index) => index === 1 ? { ...order, total_amount: periodPurchase } : order)}
      payments={[{ id: "p", amount: 500, paid_at: "2026-11-08T03:00:00Z", scope_label: "Xi măng" }]}
      debtSummary={{
        totalPurchase: 3000, paidImmediate: 0, paidLater: 500, paidTotal: 500,
        debtTotal: 2500, reconciles: true,
      }}
      groupedOrders={[]}
    >Trang khách</PrintableCustomerSection>);
  }

  it("truyền đủ đơn/trả và tổng dòng đã lọc vào bảng kê", () => {
    const html = renderSection({
      fromDate: "2026-11-08", toDate: "2026-11-21", productNames: null, categoryNames: null,
    });
    expect(html).toContain("invoice-itemlist-view");
    expect(html).not.toContain("invoice-summary-view");
    expect(html).toContain("Nợ cũ (trước 08/11/2026)");
    expect(html).toContain("1.000 đ");
    expect(html).toContain("2.000 đ");
    expect(html).toContain("− Đã trả 08/11/2026 (Xi măng)");
    expect(html).toContain("2.500 đ");
    expect(html).not.toContain('role="alert"');
  });

  it("F1: lệch thì cảnh báo trước nội dung, ngoài vùng in và fallback Tổng cộng", () => {
    const html = renderSection({
      fromDate: "2026-11-08", toDate: "2026-11-21", productNames: null, categoryNames: null,
    }, true, 2100);
    const alert = html.match(/<p[^>]*role="alert"[^>]*>[\s\S]*?<\/p>/)?.[0];
    expect(alert).toBeDefined();
    expect(alert).toContain("Tiền hàng trong kỳ theo đơn (2.100 đ)");
    expect(alert).toContain("khác tổng các dòng hàng (2.000 đ)");
    expect(alert).toContain("no-print mx-auto max-w-6xl");
    expect(alert).toContain('data-html2canvas-ignore="true"');
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf("Trang khách"));
    const printArea = html.slice(html.indexOf('class="print-area print-only"'));
    expect(printArea).not.toContain('role="alert"');
    expect(printArea).not.toContain("2.100 đ");
    expect(printArea).not.toContain("Nợ cũ (trước");
    expect(printArea).toContain("Tổng cộng");
    expect(printArea).toContain("Bằng chữ: Hai nghìn đồng");
  });

  it.each([
    { fromDate: null, toDate: "2026-11-21", productNames: null, categoryNames: null },
    { fromDate: "2026-11-08", toDate: null, productNames: ["Xi măng"], categoryNames: null },
    { fromDate: "2026-11-08", toDate: null, productNames: null, categoryNames: ["VLXD"] },
  ])("không cảnh báo lệch kỳ khi thiếu fromDate hoặc đang lọc món/nhóm: %j", (filter) => {
    const html = renderSection(filter, true, 2100);
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Tổng cộng");
  });

  it("lọc nhóm vẫn dùng bảng kê cũ; bỏ lọc vẫn dùng bảng đối chiếu", () => {
    const filter = { fromDate: null, toDate: null, productNames: null, categoryNames: null };
    const grouped = renderSection({ ...filter, categoryNames: ["VLXD"] });
    expect(grouped).toContain("invoice-itemlist-view");
    expect(grouped).toContain("Tổng cộng");
    expect(grouped).not.toContain("Nợ cũ (trước");
    const unfiltered = renderSection(filter, false);
    expect(unfiltered).toContain("invoice-summary-view");
    expect(unfiltered).not.toContain("invoice-itemlist-view");
  });
});

describe("resolvePopoverVerticalPlacement — TIP-UI7 (AC3)", () => {
  it("đủ chỗ dưới -> mở xuống, top = triggerBottom + gap", () => {
    const res = resolvePopoverVerticalPlacement({
      triggerTop: 80,
      triggerBottom: 100,
      viewportHeight: 1000,
      menuHeight: 200,
    });

    expect(res.direction).toBe("down");
    expect(res.top).toBe(100 + POPOVER_GAP);
  });

  it("không đủ dưới nhưng đủ trên -> lật lên, top = triggerTop - gap - menuHeight", () => {
    const res = resolvePopoverVerticalPlacement({
      triggerTop: 250,
      triggerBottom: 290,
      viewportHeight: 300,
      menuHeight: 200,
    });

    expect(res.direction).toBe("up");
    expect(res.top).toBe(250 - POPOVER_GAP - 200);
  });

  it("cả hai đều chật, dưới rộng hơn -> mở xuống", () => {
    const res = resolvePopoverVerticalPlacement({
      triggerTop: 130,
      triggerBottom: 150,
      viewportHeight: 300,
      menuHeight: 200,
    });

    expect(res.direction).toBe("down");
    expect(res.top).toBe(150 + POPOVER_GAP);
  });

  it("cả hai đều chật, trên rộng hơn -> lật lên, top kẹp >= gap", () => {
    const res = resolvePopoverVerticalPlacement({
      triggerTop: 170,
      triggerBottom: 190,
      viewportHeight: 300,
      menuHeight: 200,
    });

    expect(res.direction).toBe("up");
    expect(res.top).toBe(POPOVER_GAP); // Math.max(gap, 170-4-200) = 4
    expect(res.top).toBeGreaterThanOrEqual(POPOVER_GAP);
  });

  it("tôn trọng gap tùy biến truyền vào", () => {
    const res = resolvePopoverVerticalPlacement({
      triggerTop: 80,
      triggerBottom: 100,
      viewportHeight: 1000,
      menuHeight: 200,
      gap: 12,
    });

    expect(res.top).toBe(112);
  });
});

describe("InvoiceActionMenuItems — TIP-UI7 (AC4)", () => {
  const baseProps = {
    onPrint: () => {},
    onPdf: () => {},
    onImage: () => {},
    onDelete: () => {},
    isExportingPdf: false,
    isExportingImage: false,
    disabled: false,
  };

  it("render đủ 4 mục (gồm Xóa đơn) + class no-print khi showDelete=true", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceActionMenuItems, { ...baseProps, showDelete: true }),
    );

    expect(html).toContain("In hóa đơn");
    expect(html).toContain("Tải PDF");
    expect(html).toContain("Tải ảnh");
    expect(html).toContain("Xóa đơn");
    expect(html).toContain("no-print");
    expect(html).toContain('role="menu"');
  });

  it("ẩn mục Xóa đơn khi showDelete=false", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceActionMenuItems, { ...baseProps, showDelete: false }),
    );

    expect(html).toContain("In hóa đơn");
    expect(html).toContain("Tải PDF");
    expect(html).toContain("Tải ảnh");
    expect(html).not.toContain("Xóa đơn");
  });

  it("hiện trạng thái đang xuất + disable nút tương ứng", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceActionMenuItems, {
        ...baseProps,
        isExportingPdf: true,
        isExportingImage: true,
        showDelete: true,
      }),
    );

    expect(html).toContain("Đang tạo PDF");
    expect(html).toContain("Đang tạo ảnh");
    expect(html).toContain('disabled=""');
  });
});
