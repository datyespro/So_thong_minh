"use client";

import * as React from "react";
import { CapabilityChipRow } from "@/src/components/chat/capability-chip-row";
import { HistoryCommitCard } from "@/src/components/chat/history-commit-card";
import { MessageBubble } from "@/src/components/chat/message-bubble";
import { PreviewCard } from "@/src/components/chat/preview-card";
import { SamplePromptNotes } from "@/src/components/chat/sample-prompt-notes";
import { TypingIndicator } from "@/src/components/chat/typing-indicator";
import type { ChatMessageView } from "@/src/components/chat/types";
import { parseHistoryCommitCard } from "@/src/lib/chat/history-card";
import { parseCapabilityChips } from "@/src/lib/ai/capability-help";
import type {
  PipelineTurnView,
  PreviewCardPatch,
} from "@/src/components/chat/preview-card";
import type { DismissedPreviewPayload } from "@/src/components/chat/preview-card/dismissed-preview-card";
import type { PreviewDraft } from "@/src/lib/chat/preview-draft";
import type { ValidatedIntent, ValidatedLineItem } from "@/src/lib/ai/validate-schema";

type MessageListProps = Readonly<{
  ownerId: string;
  messages: ChatMessageView[];
  isProcessing: boolean;
  pipelineTurns: PipelineTurnView[];
  activeTurnId: string | null;
  restoredDraft: PreviewDraft | null;
  onPickSample: (text: string) => void;
  onPatchTurn: (turnId: string, patch: PreviewCardPatch) => void;
  onClearRestoredDraft: (payload: DismissedPreviewPayload) => void;
}>;

function isDismissedHistoryMessage(metadata: unknown) {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "source" in metadata &&
    (metadata as { source?: unknown }).source === "tip_22_dismiss"
  );
}

function restoredLineItem(item: PreviewDraft["resolved"]["items"][number]): ValidatedLineItem {
  const lineTotal =
    item.quantity !== null && item.unit_price !== null
      ? item.quantity * item.unit_price
      : item.line_total;

  return {
    ...item,
    effective_quantity: item.quantity,
    effective_unit: item.unit,
    effective_unit_price: item.unit_price,
    line_total: lineTotal,
    issues: [],
  };
}

function restoredValidatedSnapshot(draft: PreviewDraft): ValidatedIntent {
  return {
    intent: draft.intent,
    kind: "writable",
    raw_text: draft.resolved.raw_text,
    customer: draft.resolved.customer,
    supplier: draft.resolved.supplier,
    items: draft.resolved.items.map(restoredLineItem),
    effective_amount:
      draft.intent === "record_payment" ? draft.resolved.amount ?? null : null,
    issues: [],
    ready_for_preview: true,
    blocking_count: 0,
    warning_count: 0,
  };
}

export function MessageList({
  ownerId,
  messages,
  isProcessing,
  pipelineTurns,
  activeTurnId,
  restoredDraft,
  onPickSample,
  onPatchTurn,
  onClearRestoredDraft,
}: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const turnsByMessageId = React.useMemo(() => {
    const turns = new Map<string, PipelineTurnView>();

    for (const turn of pipelineTurns) {
      turns.set(turn.userMessageId, turn);
    }

    return turns;
  }, [pipelineTurns]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isProcessing, pipelineTurns, activeTurnId]);

  if (messages.length === 0 && !restoredDraft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-start px-4 pb-10 pt-20 text-center sm:pt-24">
        <SamplePromptNotes onPick={onPickSample} />
        <div ref={bottomRef} />
      </div>
    );
  }

  return (
    // Scroll viewport spans the full main width so its vertical scrollbar sits
    // flush against the window's right edge. Reading padding + the centered
    // max-width live on the inner wrapper, keeping content comfortable without
    // pushing the scrollbar inward.
    <div
      className="min-h-0 flex-1 overflow-y-auto py-4 sm:py-5"
      data-testid="message-list"
    >
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-3 sm:px-5 lg:px-6">
        {messages.map((message) => {
          const turn = turnsByMessageId.get(message.id);
          const historyCard =
            message.role === "assistant"
              ? parseHistoryCommitCard(message.metadata)
              : null;
          const capabilityChips =
            message.role === "assistant" && !historyCard
              ? parseCapabilityChips(message.metadata)
              : null;

          return (
            <React.Fragment key={message.id}>
              {historyCard ? (
                <HistoryCommitCard
                  card={historyCard}
                  confirmationText={message.content}
                  confirmationTone={
                    isDismissedHistoryMessage(message.metadata)
                      ? "dismissed"
                      : "committed"
                  }
                />
              ) : capabilityChips ? (
                <div>
                  <MessageBubble message={message} />
                  <div className="ml-0 max-w-[86%] sm:max-w-[78%]">
                    <CapabilityChipRow
                      chips={capabilityChips}
                      onPick={onPickSample}
                    />
                  </div>
                </div>
              ) : (
                <MessageBubble message={message} />
              )}
              {turn ? (
                <PreviewCard
                  validated={turn.validated}
                  answer={turn.answer ?? null}
                  productManagementPreview={turn.productManagementPreview ?? null}
                  patched={turn.patched}
                  ownerId={ownerId}
                  isLive={turn.id === activeTurnId}
                  onPatchChange={(patch) => onPatchTurn(turn.id, patch)}
                  onPickSample={onPickSample}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        {restoredDraft ? (
          <PreviewCard
            mode="restored"
            validated={restoredValidatedSnapshot(restoredDraft)}
            patched={restoredDraft.patched}
            restoredDraft={restoredDraft}
            isLive={false}
            onPatchChange={() => undefined}
            onPickSample={onPickSample}
            onRestoredDismiss={onClearRestoredDraft}
          />
        ) : null}
        {isProcessing ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
