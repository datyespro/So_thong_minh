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
});
