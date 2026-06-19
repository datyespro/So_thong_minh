import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  OrderDeleteDialogContent,
  formatDeleteSummaryLine,
  resolveUndoOutcome,
} from "@/src/components/customers/order-delete-modal";

describe("OrderDeleteModal (pure components & fns)", () => {
  describe("formatDeleteSummaryLine", () => {
    it("format đúng ngày, tiền và số lượng 1 món", () => {
      const res = formatDeleteSummaryLine({
        businessDate: "2026-04-30",
        firstItemName: "gạch A1",
        itemCount: 1,
        total: 86000000,
      });
      expect(res.dateStr).toBe("30/04/2026");
      expect(res.nameStr).toBe("gạch A1");
      expect(res.suffix).toBe("");
      expect(res.moneyStr).toBe("86.000.000 đ");
    });

    it("format đúng khi thiếu ngày hoặc tên", () => {
      const res = formatDeleteSummaryLine({
        businessDate: null,
        firstItemName: null,
        itemCount: 2,
        total: 50000,
      });
      expect(res.dateStr).toBe("—");
      expect(res.nameStr).toBe("—");
      expect(res.suffix).toBe(" … (2 món)");
      expect(res.moneyStr).toBe("50.000 đ");
    });
  });

  describe("resolveUndoOutcome", () => {
    it("trả về deleted khi ok: true", () => {
      expect(resolveUndoOutcome({ ok: true })).toBe("deleted");
      expect(resolveUndoOutcome({ ok: true, data: { already_undone: true } })).toBe("deleted");
    });

    it("trả về error khi ok: false", () => {
      expect(resolveUndoOutcome({ ok: false })).toBe("error");
      expect(resolveUndoOutcome({ ok: false, code: "db_error" } as { ok: boolean })).toBe("error");
    });
  });

  describe("OrderDeleteDialogContent", () => {
    it("render đầy đủ thông tin truyền vào", () => {
      const html = renderToStaticMarkup(
        createElement(OrderDeleteDialogContent, {
          titleId: "title1",
          descriptionId: "desc1",
          dateStr: "30/04/2026",
          nameStr: "gạch A1",
          suffix: "",
          moneyStr: "86.000.000",
          submitting: false,
          errorText: null,
          cancelButtonRef: { current: null },
          onClose: () => {},
          onDelete: () => {},
        })
      );

      expect(html).toContain("Xóa đơn này?");
      expect(html).toContain("30/04/2026");
      expect(html).toContain("gạch A1");
      expect(html).toContain("86.000.000 đ");
      expect(html).toContain("Tồn kho và công nợ sẽ được hoàn lại");
      expect(html).toContain("Hủy");
      expect(html).toContain("Xóa đơn");
    });

    it("render lỗi khi có errorText", () => {
      const html = renderToStaticMarkup(
        createElement(OrderDeleteDialogContent, {
          titleId: "title1",
          descriptionId: "desc1",
          dateStr: "30/04/2026",
          nameStr: "gạch A1",
          suffix: "",
          moneyStr: "86.000.000",
          submitting: true,
          errorText: "Lỗi đặc biệt không xóa được",
          cancelButtonRef: { current: null },
          onClose: () => {},
          onDelete: () => {},
        })
      );

      expect(html).toContain("Lỗi đặc biệt không xóa được");
      expect(html).toContain('disabled=""'); // Nút bị disabled khi submitting
    });
  });
});
