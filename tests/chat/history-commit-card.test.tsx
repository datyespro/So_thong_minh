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

  it("KHÔNG nút cho create_order (v1 chỉ record_payment)", () => {
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

    expect(html).not.toContain("Hoàn tác");
  });
});
