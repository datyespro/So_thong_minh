"use client";

import * as React from "react";
import { MessageBubble } from "@/src/components/chat/message-bubble";
import { PreviewCard } from "@/src/components/chat/preview-card";
import { SamplePromptNotes } from "@/src/components/chat/sample-prompt-notes";
import { TypingIndicator } from "@/src/components/chat/typing-indicator";
import type { ChatMessageView } from "@/src/components/chat/types";
import type {
  PipelineTurnView,
  PreviewCardPatch,
} from "@/src/components/chat/preview-card";

type MessageListProps = Readonly<{
  messages: ChatMessageView[];
  isProcessing: boolean;
  pipelineTurns: PipelineTurnView[];
  activeTurnId: string | null;
  onPickSample: (text: string) => void;
  onPatchTurn: (turnId: string, patch: PreviewCardPatch) => void;
}>;

export function MessageList({
  messages,
  isProcessing,
  pipelineTurns,
  activeTurnId,
  onPickSample,
  onPatchTurn,
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

  if (messages.length === 0) {
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

          return (
            <React.Fragment key={message.id}>
              <MessageBubble message={message} />
              {turn ? (
                <PreviewCard
                  validated={turn.validated}
                  answer={turn.answer ?? null}
                  patched={turn.patched}
                  isLive={turn.id === activeTurnId}
                  onPatchChange={(patch) => onPatchTurn(turn.id, patch)}
                />
              ) : null}
            </React.Fragment>
          );
        })}
        {isProcessing ? <TypingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
