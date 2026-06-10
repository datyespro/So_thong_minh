"use client";

import { cn } from "@/src/lib/utils";

type CapabilityChipRowProps = Readonly<{
  chips: string[];
  onPick?: (text: string) => void;
  className?: string;
}>;

export function CapabilityChipRow({
  chips,
  onPick,
  className,
}: CapabilityChipRowProps) {
  if (!onPick || chips.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("mt-3 flex flex-wrap gap-2", className)}
      data-testid="capability-chip-row"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          className="rounded border border-ledgerBorder bg-surface px-3 py-2 text-left text-[15px] leading-6 text-textMain shadow-[var(--shadow-card)] transition-colors hover:border-stamp/50 hover:bg-paperWarm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          onClick={() => onPick(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
