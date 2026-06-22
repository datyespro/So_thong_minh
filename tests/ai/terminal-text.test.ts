import { describe, expect, it } from "vitest";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import {
  commitConfirmationMessage,
  dismissedPreviewMessage,
  friendlyNoneMessage,
  queryAnswerToText,
} from "@/src/lib/ai/terminal-text";

describe("terminal chat text helpers", () => {
  it("keeps current none-branch text unchanged", () => {
    expect(friendlyNoneMessage("small_talk")).toBe("Dạ, em nghe ạ.");
    expect(friendlyNoneMessage("unknown")).toBe("Em chưa rõ ý câu này ạ.");
    expect(friendlyNoneMessage("manage_customer")).toBeNull();
  });

  it("keeps the shared money formatter null behavior", () => {
    expect(formatVietnameseMoney(null)).toBe("Chưa có");
  });

  it("formats dismissed preview messages by intent and counterparty", () => {
    expect(
      dismissedPreviewMessage({ type: "create_order", entityName: "Ngọc Anh" }),
    ).toBe("Đã bỏ đơn của Ngọc Anh");
    expect(dismissedPreviewMessage({ type: "create_order" })).toBe(
      "Đã bỏ đơn của khách",
    );
    expect(
      dismissedPreviewMessage({ type: "record_payment", entityName: "chị Lan" }),
    ).toBe("Đã bỏ thu nợ của chị Lan");
    expect(dismissedPreviewMessage({ type: "record_payment" })).toBe(
      "Đã bỏ thu nợ của khách",
    );
    expect(
      dismissedPreviewMessage({
        type: "create_purchase",
        supplierName: "NCC A",
      }),
    ).toBe("Đã bỏ nhập hàng từ NCC A");
    expect(dismissedPreviewMessage({ type: "create_purchase" })).toBe(
      "Đã bỏ nhập hàng",
    );
  });

  it("formats commit confirmation messages without changing current UI text", () => {
    expect(
      commitConfirmationMessage({
        type: "create_order",
        entityName: "anh Hùng",
      }),
    ).toBe("Đã ghi đơn cho anh Hùng");
    expect(
      commitConfirmationMessage({
        type: "record_payment",
        entityName: "chị Lan",
      }),
    ).toBe("Đã ghi thu nợ cho chị Lan");
    expect(
      commitConfirmationMessage({
        type: "create_purchase",
        supplierName: "NCC A",
      }),
    ).toBe("Đã ghi nhập hàng từ NCC A");
    expect(commitConfirmationMessage({ type: "create_purchase" })).toBe(
      "Đã ghi nhập hàng",
    );
    expect(commitConfirmationMessage({ type: "edit_order" })).toBe("Đã sửa đơn");
    expect(commitConfirmationMessage({ type: "create_order" })).toBe(
      "Đã ghi đơn cho khách",
    );
  });

  it("formats found debt answers", () => {
    expect(
      queryAnswerToText({
        type: "debt",
        state: "found",
        customerName: "Anh Hùng",
        debt: 4200000,
        lastOrderAt: null,
        lastPaymentAt: null,
      }),
    ).toBe("Anh Hùng đang nợ 4.200.000 đ");
  });

  it("formats zero debt answers", () => {
    expect(
      queryAnswerToText({
        type: "debt",
        state: "found",
        customerName: "Anh Hùng",
        debt: 0,
        lastOrderAt: null,
        lastPaymentAt: null,
      }),
    ).toBe("Anh Hùng không còn nợ ạ.");
  });

  it("formats negative debt as customer credit, not as cleared (VĐ3)", () => {
    const text = queryAnswerToText({
      type: "debt",
      state: "found",
      customerName: "chị Lan",
      debt: -77416000,
      lastOrderAt: null,
      lastPaymentAt: null,
    });
    expect(text).toBe(
      "chị Lan đã trả trước 77.416.000 đ (mình đang nợ lại khách) ạ.",
    );
    expect(text).not.toContain("không còn nợ");
  });

  it("formats positive sales answers", () => {
    expect(
      queryAnswerToText({
        type: "sales",
        state: "ok",
        rangeKind: "today",
        rangeLabel: "hôm nay",
        from: "2026-06-05",
        to: "2026-06-05",
        orders: 12,
        revenue: 18500000,
        paid: 12000000,
        debt: 6500000,
      }),
    ).toBe(
      "hôm nay: 12 đơn, doanh thu 18.500.000 đ. Đã thu 12.000.000 đ, nợ thêm 6.500.000 đ",
    );
  });

  it("formats zero-order sales answers", () => {
    expect(
      queryAnswerToText({
        type: "sales",
        state: "ok",
        rangeKind: "today",
        rangeLabel: "hôm nay",
        from: "2026-06-05",
        to: "2026-06-05",
        orders: 0,
        revenue: 0,
        paid: 0,
        debt: 0,
      }),
    ).toBe("hôm nay chưa bán đơn nào ạ.");
  });

  it("formats positive inventory answers", () => {
    expect(
      queryAnswerToText({
        type: "inventory",
        state: "found",
        productName: "xi măng",
        stock: 4,
        unit: "bao",
      }),
    ).toBe("Còn 4 bao xi măng");
  });

  it("formats zero inventory answers", () => {
    expect(
      queryAnswerToText({
        type: "inventory",
        state: "found",
        productName: "xi măng",
        stock: 0,
        unit: "bao",
      }),
    ).toBe("xi măng hết hàng rồi ạ.");
  });
});
