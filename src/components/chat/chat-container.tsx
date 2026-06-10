"use client";

import * as React from "react";
import { processMessage } from "@/app/(app)/chat/actions";
import { MessageInput } from "@/src/components/chat/message-input";
import { MessageList } from "@/src/components/chat/message-list";
import {
  createEmptyPreviewCardPatch,
  type PipelineTurnView,
  type PreviewCardPatch,
} from "@/src/components/chat/preview-card";
import type { ChatMessageView } from "@/src/components/chat/types";
import {
  isDuplicateDismissedPreviewMessage,
  type DismissedPreviewPayload,
} from "@/src/components/chat/preview-card/dismissed-preview-card";
import {
  clearDraft,
  loadDraft,
  type PreviewDraft,
} from "@/src/lib/chat/preview-draft";

type ChatContainerProps = Readonly<{
  greeting: string;
  initialMessages: ChatMessageView[];
  ownerId: string;
  todayLabel: string;
}>;

function makeTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Shared reading column: centers content at a comfortable max width with the
// same horizontal padding used by the greeting, message list, and input. Keeping
// it on each child (instead of on the scroll wrapper) lets the message list span
// the full main width so its scrollbar hugs the window's right edge.
const READING_COLUMN = "mx-auto w-full max-w-[760px] px-3 sm:px-5 lg:px-6";

export function ChatContainer({
  greeting,
  initialMessages,
  ownerId,
  todayLabel,
}: ChatContainerProps) {
  const [messages, setMessages] = React.useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [pipelineTurns, setPipelineTurns] = React.useState<PipelineTurnView[]>([]);
  const [activeTurnId, setActiveTurnId] = React.useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = React.useState<PreviewDraft | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const showGreeting = messages.length === 0;
  const hasLiveTurn =
    activeTurnId !== null && pipelineTurns.some((turn) => turn.id === activeTurnId);
  const visibleRestoredDraft =
    restoredDraft && !hasLiveTurn && !isSending && !isProcessing
      ? restoredDraft
      : null;

  React.useEffect(() => {
    setRestoredDraft(loadDraft(ownerId));
  }, [ownerId]);

  const handlePickSample = React.useCallback((text: string) => {
    setError(null);
    setInput(text);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;

      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  }, []);

  const handleSend = React.useCallback(async () => {
    const content = input.trim();

    if (!content || isSending || isProcessing) {
      return;
    }

    const tempId = makeTempId("temp-user");
    const optimisticMessage: ChatMessageView = {
      id: tempId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setError(null);
    setInput("");
    setIsSending(true);
    setIsProcessing(true);
    const previousActiveTurnId = activeTurnId;
    setActiveTurnId(null);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const result = await processMessage(content);

      if (!result.ok) {
        setMessages((current) => current.filter((message) => message.id !== tempId));
        setInput(content);
        setError(result.message);
        setActiveTurnId(previousActiveTurnId);
        return;
      }

      const pipeline = result.pipeline;

      if (!pipeline.ok) {
        const assistantMessage: ChatMessageView = {
          id: makeTempId("assistant-pipeline-error"),
          role: "assistant",
          content: pipeline.message,
          created_at: new Date().toISOString(),
          ephemeral: true,
        };

        setMessages((current) => [
          ...current.map((message) =>
            message.id === tempId ? result.userMessage : message,
          ),
          assistantMessage,
        ]);
        return;
      }

      const turnId = makeTempId("pipeline-turn");

      setPipelineTurns((current) => [
        ...current,
        {
          id: turnId,
          userMessageId: result.userMessage.id,
          validated: pipeline.validated,
          answer: result.answer ?? null,
          productManagementPreview: result.productManagementPreview ?? null,
          terminalText: result.terminalText ?? null,
          patched: createEmptyPreviewCardPatch(),
        },
      ]);
      setActiveTurnId(turnId);
      setMessages((current) =>
        current.map((message) =>
          message.id === tempId ? result.userMessage : message,
        ),
      );
    } catch {
      setMessages((current) => current.filter((message) => message.id !== tempId));
      setInput(content);
      setActiveTurnId(previousActiveTurnId);
      setError("Chưa lưu được tin, bác thử lại ạ.");
    } finally {
      setIsSending(false);
      setIsProcessing(false);
    }
  }, [activeTurnId, input, isProcessing, isSending]);

  const handlePatchTurn = React.useCallback(
    (turnId: string, patch: PreviewCardPatch) => {
      setPipelineTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                patched: patch,
              }
            : turn,
        ),
      );
    },
    [],
  );

  const handleClearRestoredDraft = React.useCallback(
    (payload: DismissedPreviewPayload) => {
      clearDraft(ownerId);
      setRestoredDraft(null);

      setMessages((current) => {
        if (isDuplicateDismissedPreviewMessage(current, payload)) {
          return current;
        }

        return [
          ...current,
          {
            id: makeTempId("assistant-dismissed-preview"),
            role: "assistant",
            content: payload.content,
            created_at: new Date().toISOString(),
            metadata: { source: "tip_22_dismiss", card: payload.card },
            ephemeral: true,
          },
        ];
      });
    },
    [ownerId],
  );

  return (
    <section className="flex h-full min-h-0 bg-paper text-textMain">
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className={READING_COLUMN}>
          <div
            className={[
              "overflow-hidden border-b border-ledgerBorder transition-[max-height,opacity,padding] duration-500 ease-out",
              showGreeting
                ? "max-h-56 py-4 opacity-100 sm:py-5"
                : "max-h-0 py-0 opacity-0",
            ].join(" ")}
            aria-hidden={!showGreeting}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stamp">
              Chat
            </p>
            <p className="mt-7 text-[15px] leading-6 text-stamp">
              {todayLabel}
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-normal text-inkDeep sm:text-5xl">
              {greeting}
            </h1>
          </div>
        </div>

        <MessageList
          ownerId={ownerId}
          messages={messages}
          isProcessing={isProcessing}
          pipelineTurns={pipelineTurns}
          activeTurnId={activeTurnId}
          restoredDraft={visibleRestoredDraft}
          onPickSample={handlePickSample}
          onPatchTurn={handlePatchTurn}
          onClearRestoredDraft={handleClearRestoredDraft}
        />

        <div className={READING_COLUMN}>
          <MessageInput
            ref={textareaRef}
            value={input}
            disabled={isSending || isProcessing}
            error={error}
            onChange={setInput}
            onSubmit={handleSend}
          />
        </div>
      </div>
    </section>
  );
}
