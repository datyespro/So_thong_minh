import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  InvoiceActionMenuItems,
  POPOVER_GAP,
  resolvePopoverVerticalPlacement,
} from "@/src/components/invoice/printable-customer-section";

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
