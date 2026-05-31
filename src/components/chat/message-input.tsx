"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type MessageInputProps = Readonly<{
  value: string;
  disabled: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}>;

export const MessageInput = React.forwardRef<HTMLTextAreaElement, MessageInputProps>(
  function MessageInput(
    {
      value,
      disabled,
      error,
      onChange,
      onSubmit,
    }: MessageInputProps,
    forwardedRef,
  ) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const canSubmit = value.trim().length > 0 && !disabled;

  const setTextareaRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      textareaRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
        return;
      }

      if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef],
  );

  React.useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();

    if (canSubmit) {
      onSubmit();
    }
  }

  return (
    <form
      className="sticky bottom-0 border-t border-ledgerBorder bg-paper pb-3 pt-3 sm:pb-5"
      onSubmit={handleSubmit}
    >
      {error ? (
        <p className="mb-2 rounded border border-debt/20 bg-red-50 px-3 py-2 text-[15px] leading-6 text-debt" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2 rounded border border-ledgerBorder bg-surface p-2 shadow-[var(--shadow-card)]">
        <textarea
          ref={setTextareaRef}
          value={value}
          disabled={disabled}
          rows={1}
          maxLength={2000}
          placeholder="Nhập tin nhắn..."
          className="max-h-36 min-h-14 flex-1 resize-none bg-transparent px-3 py-3 text-[16px] leading-7 text-textMain outline-none placeholder:text-textFaint disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Nhập tin nhắn"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-14 min-w-[92px] rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:opacity-55"
        >
          <Send className="mr-2 h-5 w-5" aria-hidden="true" />
          Gửi
        </Button>
      </div>
    </form>
  );
  },
);
