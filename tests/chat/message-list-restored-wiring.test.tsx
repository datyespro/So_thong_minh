import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PreviewCardPatch } from "@/src/components/chat/preview-card/types";
import type { PreviewDraft } from "@/src/lib/chat/preview-draft";
import { baseValidated } from "@/tests/chat/preview-card-fixtures";

const captured = vi.hoisted(() => ({
  restoredOnPatchChange: null as ((patch: PreviewCardPatch) => void) | null,
}));

vi.mock("@/src/components/chat/preview-card", () => ({
  PreviewCard: (props: {
    mode?: string;
    onPatchChange: (patch: PreviewCardPatch) => void;
  }) => {
    if (props.mode === "restored") {
      captured.restoredOnPatchChange = props.onPatchChange;
    }

    return createElement("div");
  },
}));

const { MessageList } = await import("@/src/components/chat/message-list");

describe("MessageList restored patch wiring", () => {
  it("forwards restored PreviewCard patches to the parent re-save callback", () => {
    const patched: PreviewCardPatch = {
      itemPrices: {},
      itemQuantities: {},
      amount: null,
      customer: null,
      supplier: null,
      itemProducts: {},
      removedIndices: [],
      itemsAdded: [],
    };
    const validated = baseValidated();
    const draft: PreviewDraft = {
      schemaVersion: 1,
      kind: "preview_draft",
      savedAt: "2026-06-14T09:00:00+07:00",
      businessDate: "2026-06-14",
      ownerId: "owner-1",
      intent: "create_order",
      idempotencyKey: "idem-wiring",
      validated,
      resolved: {
        intent: "create_order",
        raw_text: validated.raw_text,
        amount: null,
        payment_status: "unknown",
        payment_method: null,
        customer: validated.customer,
        supplier: null,
        items: validated.items,
        overall_status: "all_resolved",
        needs_confirmation: false,
      },
      patched,
    };
    const onPatchRestoredDraft = vi.fn();

    renderToStaticMarkup(
      createElement(MessageList, {
        ownerId: "owner-1",
        messages: [],
        isProcessing: false,
        pipelineTurns: [],
        activeTurnId: null,
        restoredDraft: draft,
        onPickSample: () => undefined,
        onPatchTurn: () => undefined,
        onPatchRestoredDraft,
        onClearRestoredDraft: () => undefined,
      }),
    );

    captured.restoredOnPatchChange?.(patched);

    expect(onPatchRestoredDraft).toHaveBeenCalledWith(patched);
  });
});
