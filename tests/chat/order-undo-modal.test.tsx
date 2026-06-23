import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  OrderUndoDialogContent,
  formatOrderUndoSummaryLine,
  performOrderUndo,
} from "@/src/components/chat/order-undo-modal";

describe("OrderUndoModal (pure components & fns)", () => {
  describe("formatOrderUndoSummaryLine", () => {
    it("format đúng ngày, tên, tiền", () => {
      const res = formatOrderUndoSummaryLine({
        target: "order",
        businessDate: "2026-04-30",
        entityName: "anh Tuấn",
        totalAmount: 300000,
      });
      expect(res.dateStr).toBe("30/04/2026");
      expect(res.nameStr).toBe("anh Tuấn");
      expect(res.moneyStr).toBe("300.000 đ");
    });

    it("order: thiếu ngày → null; tên rỗng → 'Khách lẻ'; tiền null → '—'", () => {
      const res = formatOrderUndoSummaryLine({
        target: "order",
        businessDate: null,
        entityName: null,
        totalAmount: null,
      });
      expect(res.dateStr).toBeNull();
      expect(res.nameStr).toBe("Khách lẻ");
      expect(res.moneyStr).toBe("—");
    });

    it("purchase: tên rỗng → 'Chưa có NCC'", () => {
      const res = formatOrderUndoSummaryLine({
        target: "purchase",
        businessDate: null,
        entityName: "  ",
        totalAmount: 500000,
      });
      expect(res.nameStr).toBe("Chưa có NCC");
      expect(res.moneyStr).toBe("500.000 đ");
    });
  });

  describe("OrderUndoDialogContent", () => {
    it("order: tiêu đề + cảnh báo hoàn tồn + nợ", () => {
      const html = renderToStaticMarkup(
        createElement(OrderUndoDialogContent, {
          target: "order",
          titleId: "t1",
          descriptionId: "d1",
          dateStr: "30/04/2026",
          nameStr: "anh Tuấn",
          moneyStr: "300.000",
          submitting: false,
          errorText: null,
          cancelButtonRef: { current: null },
          onClose: () => {},
          onUndo: () => {},
        }),
      );

      expect(html).toContain("Hoàn tác đơn bán này?");
      expect(html).toContain("30/04/2026");
      expect(html).toContain("anh Tuấn");
      expect(html).toContain("300.000 đ");
      expect(html).toContain("Tồn kho và công nợ sẽ được hoàn lại");
      expect(html).toContain("Hủy");
      expect(html).toContain("Hoàn tác");
    });

    it("purchase: tiêu đề + cảnh báo chỉ hoàn tồn (không nhắc công nợ)", () => {
      const html = renderToStaticMarkup(
        createElement(OrderUndoDialogContent, {
          target: "purchase",
          titleId: "t1",
          descriptionId: "d1",
          dateStr: null,
          nameStr: "Chưa có NCC",
          moneyStr: "500.000",
          submitting: false,
          errorText: null,
          cancelButtonRef: { current: null },
          onClose: () => {},
          onUndo: () => {},
        }),
      );

      expect(html).toContain("Hoàn tác đơn nhập này?");
      expect(html).toContain("Tồn kho sẽ được hoàn lại");
      expect(html).not.toContain("công nợ");
    });

    it("render lỗi + disabled khi submitting", () => {
      const html = renderToStaticMarkup(
        createElement(OrderUndoDialogContent, {
          target: "order",
          titleId: "t1",
          descriptionId: "d1",
          dateStr: null,
          nameStr: "Khách lẻ",
          moneyStr: "—",
          submitting: true,
          errorText: "Chưa hoàn tác được, bác thử lại ạ.",
          cancelButtonRef: { current: null },
          onClose: () => {},
          onUndo: () => {},
        }),
      );

      expect(html).toContain("Chưa hoàn tác được, bác thử lại ạ.");
      expect(html).toContain('disabled=""');
    });
  });

  describe("performOrderUndo", () => {
    it("order: gọi undoAction('order', id) và chạy onUndone khi ok", async () => {
      const undoAction = vi.fn().mockResolvedValue({ ok: true });
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performOrderUndo({
        undoAction,
        target: "order",
        commitId: "o1",
        onUndone,
        onError,
      });

      expect(undoAction).toHaveBeenCalledWith("order", "o1");
      expect(outcome).toBe("deleted");
      expect(onUndone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("purchase: gọi undoAction('purchase', id)", async () => {
      const undoAction = vi.fn().mockResolvedValue({ ok: true });
      const onUndone = vi.fn();
      const onError = vi.fn();

      await performOrderUndo({
        undoAction,
        target: "purchase",
        commitId: "pu1",
        onUndone,
        onError,
      });

      expect(undoAction).toHaveBeenCalledWith("purchase", "pu1");
      expect(onUndone).toHaveBeenCalledTimes(1);
    });

    it("idempotent: already_undone vẫn 'deleted' → onUndone (không nhân đôi tồn/nợ)", async () => {
      const undoAction = vi
        .fn()
        .mockResolvedValue({ ok: true, data: { already_undone: true } });
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performOrderUndo({
        undoAction,
        target: "order",
        commitId: "o1",
        onUndone,
        onError,
      });

      expect(outcome).toBe("deleted");
      expect(onUndone).toHaveBeenCalledTimes(1);
    });

    it("ok:false → 'error', chạy onError, KHÔNG onUndone", async () => {
      const undoAction = vi.fn().mockResolvedValue({ ok: false });
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performOrderUndo({
        undoAction,
        target: "order",
        commitId: "o1",
        onUndone,
        onError,
      });

      expect(outcome).toBe("error");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onUndone).not.toHaveBeenCalled();
    });

    it("undoAction throw → 'error', chạy onError", async () => {
      const undoAction = vi.fn().mockRejectedValue(new Error("boom"));
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performOrderUndo({
        undoAction,
        target: "purchase",
        commitId: "pu1",
        onUndone,
        onError,
      });

      expect(outcome).toBe("error");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onUndone).not.toHaveBeenCalled();
    });
  });
});
