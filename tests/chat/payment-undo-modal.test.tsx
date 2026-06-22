import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  PaymentUndoDialogContent,
  formatPaymentUndoSummaryLine,
  performPaymentUndo,
} from "@/src/components/chat/payment-undo-modal";

describe("PaymentUndoModal (pure components & fns)", () => {
  describe("formatPaymentUndoSummaryLine", () => {
    it("format đúng ngày, tên, tiền", () => {
      const res = formatPaymentUndoSummaryLine({
        businessDate: "2026-04-30",
        entityName: "anh Tuấn",
        amount: 200000,
      });
      expect(res.dateStr).toBe("30/04/2026");
      expect(res.nameStr).toBe("anh Tuấn");
      expect(res.moneyStr).toBe("200.000 đ");
    });

    it("thiếu ngày → null; tên rỗng → 'Khách lẻ'; tiền null → '—'", () => {
      const res = formatPaymentUndoSummaryLine({
        businessDate: null,
        entityName: null,
        amount: null,
      });
      expect(res.dateStr).toBeNull();
      expect(res.nameStr).toBe("Khách lẻ");
      expect(res.moneyStr).toBe("—");
    });
  });

  describe("PaymentUndoDialogContent", () => {
    it("render đầy đủ tiêu đề, tóm tắt, cảnh báo, nút", () => {
      const html = renderToStaticMarkup(
        createElement(PaymentUndoDialogContent, {
          titleId: "t1",
          descriptionId: "d1",
          dateStr: "30/04/2026",
          nameStr: "anh Tuấn",
          moneyStr: "200.000",
          submitting: false,
          errorText: null,
          cancelButtonRef: { current: null },
          onClose: () => {},
          onUndo: () => {},
        }),
      );

      expect(html).toContain("Hoàn tác khoản thu này?");
      expect(html).toContain("30/04/2026");
      expect(html).toContain("anh Tuấn");
      expect(html).toContain("200.000 đ");
      expect(html).toContain("Công nợ sẽ được hoàn lại");
      expect(html).not.toContain("Tồn kho"); // cọc không đụng kho
      expect(html).toContain("Hủy");
      expect(html).toContain("Hoàn tác");
    });

    it("render lỗi + disabled khi submitting", () => {
      const html = renderToStaticMarkup(
        createElement(PaymentUndoDialogContent, {
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

  describe("performPaymentUndo", () => {
    it("gọi undoAction đúng ('payment', id) và chạy onUndone khi ok", async () => {
      const undoAction = vi.fn().mockResolvedValue({ ok: true });
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performPaymentUndo({
        undoAction,
        paymentId: "p1",
        onUndone,
        onError,
      });

      expect(undoAction).toHaveBeenCalledWith("payment", "p1");
      expect(outcome).toBe("deleted");
      expect(onUndone).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it("idempotent: already_undone vẫn 'deleted' → onUndone (không hoàn nợ 2 lần)", async () => {
      const undoAction = vi
        .fn()
        .mockResolvedValue({ ok: true, data: { already_undone: true } });
      const onUndone = vi.fn();
      const onError = vi.fn();

      const outcome = await performPaymentUndo({
        undoAction,
        paymentId: "p1",
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

      const outcome = await performPaymentUndo({
        undoAction,
        paymentId: "p1",
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

      const outcome = await performPaymentUndo({
        undoAction,
        paymentId: "p1",
        onUndone,
        onError,
      });

      expect(outcome).toBe("error");
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onUndone).not.toHaveBeenCalled();
    });
  });
});
