"use client";

import * as React from "react";
import { CapabilityChipRow } from "@/src/components/chat/capability-chip-row";
import { HistoryCommitCard } from "@/src/components/chat/history-commit-card";
import { HistoryProductCard } from "@/src/components/chat/history-product-card";
import { MessageBubble } from "@/src/components/chat/message-bubble";
import { PreviewCard } from "@/src/components/chat/preview-card";
import { SamplePromptNotes } from "@/src/components/chat/sample-prompt-notes";
import { TypingIndicator } from "@/src/components/chat/typing-indicator";
import type { ChatMessageView } from "@/src/components/chat/types";
import {
  parseHistoryCommitCard,
  parseHistoryProductCard,
} from "@/src/lib/chat/history-card";
import { parseCapabilityChips } from "@/src/lib/ai/capability-help";
import type {
  PipelineTurnView,
  PreviewCardPatch,
} from "@/src/components/chat/preview-card";
import type { DismissedPreviewPayload } from "@/src/components/chat/preview-card/dismissed-preview-card";
import { getPatchedPreviewState } from "@/src/components/chat/preview-card/preview-state";
import {
  validatedIntentForPreviewDraft,
  type PreviewDraft,
} from "@/src/lib/chat/preview-draft";

type MessageListProps = Readonly<{
  ownerId: string;
  messages: ChatMessageView[];
  isProcessing: boolean;
  pipelineTurns: PipelineTurnView[];
  activeTurnId: string | null;
  restoredDraft: PreviewDraft | null;
  onPickSample: (text: string) => void;
  onPatchTurn: (turnId: string, patch: PreviewCardPatch) => void;
  onPatchRestoredDraft: (patch: PreviewCardPatch) => void;
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

export function restoredValidatedSnapshot(draft: PreviewDraft) {
  const validated = validatedIntentForPreviewDraft(draft);
  const state = getPatchedPreviewState(validated, draft.patched);

  return {
    ...validated,
    ready_for_preview: state.canConfirm,
    blocking_count: state.blockingCount,
    warning_count: state.warningCount,
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
  onPatchRestoredDraft,
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
          const historyProductCard =
            message.role === "assistant" && !historyCard
              ? parseHistoryProductCard(message.metadata)
              : null;
          const capabilityChips =
            message.role === "assistant" && !historyCard && !historyProductCard
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
              ) : historyProductCard ? (
                <HistoryProductCard
                  card={historyProductCard}
                  confirmationText={message.content}
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
              {turn && !historyCard && !historyProductCard ? (
                <PreviewCard
                  validated={turn.validated}
                  answer={turn.answer ?? null}
                  productManagementPreview={turn.productManagementPreview ?? null}
                  terminalText={turn.terminalText ?? null}
                  aiTurnId={turn.aiTurnId ?? null}
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
            onPatchChange={onPatchRestoredDraft}
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
