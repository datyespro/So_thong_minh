"use client";

export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start" role="status" aria-live="polite">
      <div className="rounded border border-ledgerBorder bg-surface px-4 py-3 text-[16px] leading-7 text-textMute shadow-sm">
        Đang đọc...
      </div>
    </div>
  );
}
