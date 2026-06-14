import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MessageList,
  restoredValidatedSnapshot,
} from "@/src/components/chat/message-list";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import { resolvedIntentForPreviewDraft } from "@/src/components/chat/preview-card/preview-card";
import type { PreviewDraft } from "@/src/lib/chat/preview-draft";
import {
  baseValidated,
  item,
  productUnresolvedIssue,
} from "@/tests/chat/preview-card-fixtures";

function unresolvedDraft(): PreviewDraft {
  const validated = baseValidated({
    items: [
      item({
        resolution: {
          raw: "xi măng",
          entity_type: "product",
          status: "not_found",
          resolved_id: null,
          resolved_name: null,
          confidence: 0,
          candidates: [],
        },
        issues: [productUnresolvedIssue()],
      }),
    ],
    ready_for_preview: false,
    blocking_count: 1,
  });
  const patched = createEmptyPreviewCardPatch();
  const resolved = resolvedIntentForPreviewDraft(validated, patched);

  if (!resolved) {
    throw new Error("expected unresolved draftable intent");
  }

  return {
    schemaVersion: 1,
    kind: "preview_draft",
    savedAt: "2026-06-14T09:00:00+07:00",
    businessDate: "2026-06-14",
    ownerId: "owner-1",
    intent: "create_order",
    idempotencyKey: "idem-unresolved-card",
    validated,
    resolved,
    patched,
  };
}

describe("MessageList restored unresolved draft", () => {
  it("renders inline product creation while keeping confirm blocked and live-only actions hidden", () => {
    const restoredDraft = unresolvedDraft();
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

    expect(html).toContain('data-testid="preview-card-restored"');
    expect(html).toContain('data-testid="product-create-panel"');
    expect(html).toContain('data-testid="restored-confirm-button"');
    expect(html).toContain("Còn thiếu thông tin, bác bổ sung trên thẻ");
    expect(html.match(/>Ghi đơn<\/button>/g) ?? []).toHaveLength(1);
    expect(html).not.toContain("Hoàn tác");
    expect(html).not.toContain("Sửa Đơn");
    expect(html).not.toContain("Ghi lại");
  });

  it("recomputes blocking from the persisted snapshot and current patch", () => {
    const draft = unresolvedDraft();
    const blocked = restoredValidatedSnapshot(draft);
    const resolved = restoredValidatedSnapshot({
      ...draft,
      patched: {
        ...draft.patched,
        itemProducts: {
          0: {
            entity_type: "product",
            raw: "xi măng",
            resolved_id: "product-xi-mang",
            resolved_name: "xi măng",
          },
        },
      },
    });

    expect(blocked.blocking_count).toBe(1);
    expect(blocked.ready_for_preview).toBe(false);
    expect(resolved.blocking_count).toBe(0);
    expect(resolved.ready_for_preview).toBe(true);
  });
});
