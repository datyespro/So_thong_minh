"use client";

import { Printer } from "lucide-react";
import { Button } from "@/src/components/ui/button";

export function PrintButton({ label = "In" }: Readonly<{ label?: string }>) {
  return (
    <Button
      type="button"
      onClick={() => window.print()}
      className="no-print h-11 rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
