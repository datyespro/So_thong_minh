"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { ChatMessageView } from "@/src/components/chat/types";

type MessageBubbleProps = Readonly<{
  message: ChatMessageView;
}>;

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded px-4 py-3 text-[16px] leading-7 shadow-sm sm:max-w-[78%]",
          isUser
            ? "bg-ink text-paper"
            : "border border-ledgerBorder bg-surface text-textMain",
          message.pending && "opacity-65",
          message.ephemeral && "border-dashed bg-paperWarm text-textMute shadow-none",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.pending ? (
          <span className="mt-2 inline-flex items-center text-paper/80">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Đang gửi</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
