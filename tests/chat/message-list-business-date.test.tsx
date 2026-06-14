import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageList } from "@/src/components/chat/message-list";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import { resolvedIntentForPreviewDraft } from "@/src/components/chat/preview-card/preview-card";
import type { PreviewDraft } from "@/src/lib/chat/preview-draft";
import { baseValidated } from "@/tests/chat/preview-card-fixtures";

describe("MessageList restored draft business date", () => {
  it("renders the transaction date stored in the resolved draft", () => {
    const patched = createEmptyPreviewCardPatch();
    const resolved = resolvedIntentForPreviewDraft(
      baseValidated({ business_date: "2026-06-01" }),
      patched,
    );

    if (!resolved) {
      throw new Error("expected draftable resolved intent");
    }

    const restoredDraft: PreviewDraft = {
      schemaVersion: 1,
      kind: "preview_draft",
      savedAt: "2026-06-11T09:00:00+07:00",
      businessDate: "2026-06-11",
      ownerId: "owner-1",
      intent: "create_order",
      idempotencyKey: "idem-dated-draft",
      resolved,
      patched,
    };
    const html = renderToStaticMarkup(
      createElement(MessageList, {
        ownerId: "owner-1",
        messages: [],
        isProcessing: false,
        pipelineTurns: [],
        activeTurnId: null,
        restoredDraft,
        onPickSample: () => undefined,
        onPatchTurn: () => undefined,
        onPatchRestoredDraft: () => undefined,
        onClearRestoredDraft: () => undefined,
      }),
    );

    expect(html).toContain("01/06/2026");
  });
});
