import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryCommitCard } from "@/src/components/chat/history-commit-card";
import type { HistoryCommitCard as HistoryCommitCardData } from "@/src/lib/chat/history-card";

const paymentCard: HistoryCommitCardData = {
  v: 1,
  kind: "record_payment",
  entity_name: "anh Tuấn",
  business_date: null,
  total_amount: null,
  debt_amount: null,
  amount: 200000,
  items: null,
  source_id: "payment-1",
  scope_label: null,
};

function render(props: Parameters<typeof HistoryCommitCard>[0]) {
  return renderToStaticMarkup(createElement(HistoryCommitCard, props));
}

describe("HistoryCommitCard undo (UNDO-HIST)", () => {
  it("hiện nút 'Hoàn tác' khi record_payment committed + source_id + chưa undone", () => {
    const html = render({
      card: paymentCard,
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
    });

    expect(html).toContain("Hoàn tác");
    expect(html).toContain("Đã ghi thu nợ cho anh Tuấn");
  });

  it("undone=true → KHÔNG nút + 'Đã hoàn tác' xám, bỏ qua confirmationText gốc", () => {
    const html = render({
      card: paymentCard,
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
      undone: true,
    });

    expect(html).toContain("Đã hoàn tác");
    // Nút "Hoàn tác" (H hoa) KHÔNG còn; chữ "Đã ghi thu nợ" gốc bị thay.
    expect(html).not.toContain("Hoàn tác");
    expect(html).not.toContain("Đã ghi thu nợ cho anh Tuấn");
    // Tông xám (dismissed) + không tick xanh.
    expect(html).toContain("text-textMute");
    expect(html).not.toContain("lucide-check");
  });

  it("KHÔNG nút khi thiếu source_id", () => {
    const html = render({
      card: { ...paymentCard, source_id: null },
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
    });

    expect(html).not.toContain("Hoàn tác");
  });

  it("KHÔNG nút khi tone là dismissed (thẻ đã bỏ)", () => {
    const html = render({
      card: paymentCard,
      confirmationText: "Đã bỏ thu nợ của anh Tuấn",
      confirmationTone: "dismissed",
    });

    expect(html).not.toContain("Hoàn tác");
  });

  it("CÓ nút 'Hoàn tác' cho create_order committed + source_id (UNDO-HIST2)", () => {
    const orderCard: HistoryCommitCardData = {
      ...paymentCard,
      kind: "create_order",
      amount: null,
      total_amount: 300000,
      debt_amount: 300000,
      items: [
        { name: "xi măng", quantity: 3, unit: "bao", unit_price: 100000, line_total: 300000 },
      ],
      source_id: "order-1",
    };

    const html = render({
      card: orderCard,
      confirmationText: "Đã ghi đơn cho anh Tuấn",
      confirmationTone: "committed",
    });

    expect(html).toContain("Hoàn tác");
    // create_order KHÔNG có nút "Đổi nhóm" (chỉ payment).
    expect(html).not.toContain("Đổi nhóm");
  });

  it("CÓ nút 'Hoàn tác' cho create_purchase committed + source_id (UNDO-HIST2)", () => {
    const purchaseCard: HistoryCommitCardData = {
      ...paymentCard,
      kind: "create_purchase",
      entity_name: "NCC Minh Phát",
      amount: null,
      total_amount: 500000,
      debt_amount: null,
      items: [
        { name: "cát", quantity: 5, unit: "khối", unit_price: 100000, line_total: 500000 },
      ],
      source_id: "purchase-1",
    };

    const html = render({
      card: purchaseCard,
      confirmationText: "Đã ghi đơn nhập từ NCC Minh Phát",
      confirmationTone: "committed",
    });

    expect(html).toContain("Hoàn tác");
    expect(html).not.toContain("Đổi nhóm");
  });

  it("KHÔNG nút khi create_order undone → 'Đã hoàn tác'", () => {
    const orderCard: HistoryCommitCardData = {
      ...paymentCard,
      kind: "create_order",
      amount: null,
      total_amount: 300000,
      debt_amount: 300000,
      source_id: "order-1",
    };

    const html = render({
      card: orderCard,
      confirmationText: "Đã ghi đơn cho anh Tuấn",
      confirmationTone: "committed",
      undone: true,
    });

    expect(html).toContain("Đã hoàn tác");
    expect(html).not.toContain("Hoàn tác");
  });

  it("KHÔNG nút cho edit_order (ngoài phạm vi UNDO-HIST2)", () => {
    const editCard: HistoryCommitCardData = {
      ...paymentCard,
      kind: "edit_order",
      amount: null,
      total_amount: 300000,
      debt_amount: 300000,
      source_id: "order-1",
    };

    const html = render({
      card: editCard,
      confirmationText: "Đã sửa đơn cho anh Tuấn",
      confirmationTone: "committed",
    });

    expect(html).not.toContain("Hoàn tác");
  });
});

describe("HistoryCommitCard đổi nhóm (DC-4b)", () => {
  it("hiện nút 'Đổi nhóm' khi record_payment committed + source_id + chưa undone", () => {
    const html = render({
      card: paymentCard,
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
      messageId: "msg-1",
    });

    expect(html).toContain("Đổi nhóm");
    // Cạnh nút Hoàn tác.
    expect(html).toContain("Hoàn tác");
  });

  it("hiện dòng 'Nhóm' khi scope_label có giá trị", () => {
    const html = render({
      card: { ...paymentCard, scope_label: "Xi măng" },
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
    });

    expect(html).toContain("Nhóm");
    expect(html).toContain("Xi măng");
  });

  it("KHÔNG nút 'Đổi nhóm' khi undone", () => {
    const html = render({
      card: paymentCard,
      confirmationText: "Đã ghi thu nợ cho anh Tuấn",
      confirmationTone: "committed",
      undone: true,
    });

    expect(html).not.toContain("Đổi nhóm");
  });

  it("KHÔNG nút 'Đổi nhóm' khi dismissed / thiếu source_id / create_order", () => {
    expect(
      render({
        card: paymentCard,
        confirmationText: "Đã bỏ",
        confirmationTone: "dismissed",
      }),
    ).not.toContain("Đổi nhóm");

    expect(
      render({
        card: { ...paymentCard, source_id: null },
        confirmationText: "Đã ghi",
        confirmationTone: "committed",
      }),
    ).not.toContain("Đổi nhóm");

    expect(
      render({
        card: {
          ...paymentCard,
          kind: "create_order",
          amount: null,
          total_amount: 300000,
          debt_amount: 300000,
          source_id: "order-1",
        },
        confirmationText: "Đã ghi đơn",
        confirmationTone: "committed",
      }),
    ).not.toContain("Đổi nhóm");
  });
});
