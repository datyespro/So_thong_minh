import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageList } from "@/src/components/chat/message-list";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import type { ChatMessageView } from "@/src/components/chat/types";
import type { PipelineTurnView } from "@/src/components/chat/preview-card";
import {
  baseValidated,
  item,
  missingPriceIssue,
} from "@/tests/chat/preview-card-fixtures";

function renderMessageList({
  messages,
  isProcessing = false,
  pipelineTurns = [],
  activeTurnId = null,
}: {
  messages: ChatMessageView[];
  isProcessing?: boolean;
  pipelineTurns?: PipelineTurnView[];
  activeTurnId?: string | null;
}) {
  return renderToStaticMarkup(
    createElement(MessageList, {
      ownerId: "owner-1",
      messages,
      isProcessing,
      pipelineTurns,
      activeTurnId,
      restoredDraft: null,
      onPickSample: () => undefined,
      onPatchTurn: () => undefined,
      onClearRestoredDraft: () => undefined,
    }),
  );
}

describe("MessageList", () => {
  it("renders a friendly empty state with sample notes", () => {
    const html = renderMessageList({ messages: [] });

    expect(html).not.toContain("Mở sổ rồi");
    expect(html).toContain("GHI ĐƠN");
    expect(html).toContain("THU NỢ");
    expect(html).toContain("HỎI");
    expect(html).toContain("BÁO CÁO");
    expect(html).toContain("anh Hùng mua 20 bao xi măng 1,6 triệu");
  });

  it("renders messages in chronological order", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "user",
        content: "Tin đầu",
        created_at: "2026-05-29T03:00:00.000Z",
      },
      {
        id: "message-2",
        role: "assistant",
        content: "Tin thứ hai",
        created_at: "2026-05-29T03:01:00.000Z",
        ephemeral: true,
      },
      {
        id: "message-3",
        role: "user",
        content: "Tin cuối",
        created_at: "2026-05-29T03:02:00.000Z",
        pending: true,
      },
    ];

    const html = renderMessageList({ messages });

    expect(html.indexOf("Tin đầu")).toBeLessThan(html.indexOf("Tin thứ hai"));
    expect(html.indexOf("Tin thứ hai")).toBeLessThan(html.indexOf("Tin cuối"));
    expect(html).toContain("Đang gửi");
  });

  it("hides sample notes when chat history exists", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "user",
        content: "Đã có lịch sử",
        created_at: "2026-05-29T03:00:00.000Z",
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).toContain("Đã có lịch sử");
    expect(html).not.toContain("GHI ĐƠN");
    expect(html).not.toContain("anh Hùng mua 20 bao xi măng");
  });

  it("renders the processing indicator and preview card", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "user",
        content: "anh Hùng mua 20 bao xi măng",
        created_at: "2026-05-29T03:00:00.000Z",
      },
    ];
    const turns: PipelineTurnView[] = [
      {
        id: "turn-1",
        userMessageId: "message-1",
        validated: baseValidated(),
        patched: createEmptyPreviewCardPatch(),
      },
    ];

    const html = renderMessageList({
      messages,
      isProcessing: true,
      pipelineTurns: turns,
      activeTurnId: "turn-1",
    });

    expect(html).toContain("Đang đọc...");
    expect(html).toContain("Đơn bán hàng");
    expect(html).toContain("anh Hùng");
    expect(html).toContain("1.600.000 đ");
  });

  it("freezes older preview cards when a newer turn is active", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "user",
        content: "anh Hùng mua xi măng",
        created_at: "2026-05-29T03:00:00.000Z",
      },
      {
        id: "message-2",
        role: "user",
        content: "anh Hùng mua 20 bao xi măng",
        created_at: "2026-05-29T03:01:00.000Z",
      },
    ];
    const turns: PipelineTurnView[] = [
      {
        id: "turn-1",
        userMessageId: "message-1",
        validated: baseValidated({
          items: [
            item({
              unit_price: null,
              effective_unit_price: null,
              line_total: null,
              issues: [missingPriceIssue()],
            }),
          ],
          effective_amount: null,
          ready_for_preview: false,
          blocking_count: 1,
        }),
        patched: {
          ...createEmptyPreviewCardPatch(),
          itemPrices: { 0: 100000 },
        },
      },
      {
        id: "turn-2",
        userMessageId: "message-2",
        validated: baseValidated(),
        patched: createEmptyPreviewCardPatch(),
      },
    ];

    const html = renderMessageList({
      messages,
      pipelineTurns: turns,
      activeTurnId: "turn-2",
    });

    expect(html).toContain('data-testid="preview-card-frozen"');
    expect(html).toContain('data-testid="preview-card-live"');
    expect(html.match(/Ghi đơn/g) ?? []).toHaveLength(1);
    expect(html).toContain("2.000.000 đ");
  });

  it("renders a persisted commit card from assistant metadata and hides the text bubble", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "assistant",
        content: "Đã ghi đơn cho anh Hùng",
        created_at: "2026-06-02T03:00:00.000Z",
        metadata: {
          source: "tip_18b",
          order_id: "order-1",
          card: {
            v: 1,
            kind: "create_order",
            entity_name: "anh Hùng",
            business_date: "2026-06-02",
            total_amount: 300000,
            debt_amount: 300000,
            amount: null,
            items: [
              {
                name: "xi măng",
                quantity: 3,
                unit: "bao",
                unit_price: 100000,
                line_total: 300000,
              },
            ],
            source_id: "order-1",
          },
        },
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).toContain('data-testid="history-commit-card"');
    expect(html).toContain("Đơn bán hàng");
    expect(html).toContain("anh Hùng");
    expect(html).toContain("xi măng");
    expect(html).toContain("300.000 đ");
    expect(html).toContain("Đã ghi đơn cho anh Hùng");
    expect(html).toContain("lucide-check");
    expect(html).toContain(
      'class="flex items-center gap-2 text-[16px] font-semibold leading-6 text-paid"',
    );
    expect(html).not.toContain("Hoàn tác");
    expect(html).not.toContain("Sửa Đơn");
    expect(html).not.toContain("Cần kiểm tra");
  });

  it("falls back to the text bubble for invalid history card metadata", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "assistant",
        content: "Đã ghi đơn cho anh Hùng",
        created_at: "2026-06-02T03:00:00.000Z",
        metadata: {
          card: {
            v: 2,
          },
        },
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).not.toContain('data-testid="history-commit-card"');
    expect(html).toContain("Đã ghi đơn cho anh Hùng");
  });

  it("renders persisted capability chips under an assistant text bubble", () => {
    const html = renderMessageList({
      messages: [
        {
          id: "message-1",
          role: "assistant",
          content:
            "Dạ bác nhắn kiểu: [Tên khách] trả [số tiền]. Em hiện thẻ xem trước cho bác bấm Ghi ạ.",
          created_at: "2026-06-10T03:00:00.000Z",
          metadata: {
            source: "tip_25a_capability",
            chips: ["Anh Hùng trả 200k"],
          },
        },
      ],
    });

    expect(html).toContain("Anh Hùng trả 200k");
    expect(html).toContain('data-testid="capability-chip-row"');
    expect(html).not.toContain('data-testid="history-commit-card"');
  });

  it("renders a dismissed preview card without the committed check tone", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "assistant",
        content: "Đã bỏ đơn của Ngọc Anh",
        created_at: "2026-06-02T03:00:00.000Z",
        metadata: {
          source: "tip_22_dismiss",
          card: {
            v: 1,
            kind: "create_order",
            entity_name: "Ngọc Anh",
            business_date: "2026-06-02",
            total_amount: 100000,
            debt_amount: null,
            amount: null,
            items: [
              {
                name: "xi măng",
                quantity: 1,
                unit: "bao",
                unit_price: 100000,
                line_total: 100000,
              },
            ],
            source_id: null,
          },
        },
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).toContain('data-testid="history-commit-card"');
    expect(html).toContain("Đã bỏ đơn của Ngọc Anh");
    expect(html).not.toContain("lucide-check");
    expect(html).toContain(
      'class="flex items-center gap-2 text-[16px] font-semibold leading-6 text-textMute"',
    );
  });

  it("falls back to a text bubble when a dismissed preview has no valid card", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "assistant",
        content: "Đã bỏ đơn của khách",
        created_at: "2026-06-02T03:00:00.000Z",
        metadata: {
          source: "tip_22_dismiss",
          card: null,
        },
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).not.toContain('data-testid="history-commit-card"');
    expect(html).toContain("Đã bỏ đơn của khách");
  });

  it("shows walk-in customer text when a persisted order card has no customer name", () => {
    const messages: ChatMessageView[] = [
      {
        id: "message-1",
        role: "assistant",
        content: "Đã ghi đơn cho khách",
        created_at: "2026-06-02T03:00:00.000Z",
        metadata: {
          card: {
            v: 1,
            kind: "create_order",
            entity_name: null,
            business_date: "2026-06-02",
            total_amount: 100000,
            debt_amount: 100000,
            amount: null,
            items: [
              {
                name: "gạch",
                quantity: 10,
                unit: "viên",
                unit_price: 10000,
                line_total: 100000,
              },
            ],
            source_id: "order-1",
          },
        },
      },
    ];

    const html = renderMessageList({ messages });

    expect(html).toContain("Khách lẻ");
  });
});
