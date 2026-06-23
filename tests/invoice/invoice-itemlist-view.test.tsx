import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceItemListView } from "@/src/components/invoice/invoice-itemlist-view";
import type { HistoryFilter } from "@/src/lib/customers/filter-history";

const baseProps = {
  shopSettings: { shop_name: "Cửa hàng A", phone: "0900", address: "Số 1" },
  customerName: "Khách 1",
  customerPhone: null,
  rows: [],
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
