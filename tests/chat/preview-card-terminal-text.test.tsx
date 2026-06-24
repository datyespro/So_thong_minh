import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewCard } from "@/src/components/chat/preview-card/preview-card";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import { baseValidated } from "@/tests/chat/preview-card-fixtures";

function renderNoneCard(
  validated: ValidatedIntent,
  terminalText: string | null,
) {
  return renderToStaticMarkup(
    createElement(PreviewCard, {
      validated,
      terminalText,
      patched: createEmptyPreviewCardPatch(),
      isLive: true,
      onPickSample: () => undefined,
      onPatchChange: () => undefined,
    }),
  );
}

function smallTalkValidated(rawText: string): ValidatedIntent {
  return baseValidated({
    intent: "small_talk",
    kind: "none",
    raw_text: rawText,
    customer: null,
    items: [],
    effective_amount: null,
    ready_for_preview: false,
  });
}

describe("PreviewCard terminalText (tip 25b)", () => {
  it("renders the server-provided LLM reply for pure small_talk", () => {
    const html = renderNoneCard(
      smallTalkValidated("chào em"),
      "Dạ em chào bác, bác cần ghi gì cứ nhắn em ạ.",
    );

    expect(html).toContain("Dạ em chào bác, bác cần ghi gì cứ nhắn em ạ.");
    expect(html).not.toContain("Dạ, em nghe ạ.");
  });

  it("falls back to the legacy small_talk text when terminalText is null", () => {
    const html = renderNoneCard(smallTalkValidated("chào em"), null);

    expect(html).toContain("Dạ, em nghe ạ.");
  });

  it("keeps capability help and chips ahead of terminalText", () => {
    const html = renderNoneCard(
      smallTalkValidated("em làm được gì"),
      "Dạ em chào bác ạ.",
    );

    expect(html).toContain("Dạ em là Sổ Thông Minh");
    expect(html).toContain('data-testid="capability-chip-row"');
    expect(html).not.toContain("Dạ em chào bác ạ.");
  });

  it("keeps the unknown branch unchanged", () => {
    const html = renderNoneCard(
      baseValidated({
        intent: "unknown",
        kind: "none",
        raw_text: "???",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      null,
    );

    expect(html).toContain("Em chưa rõ ý câu này ạ.");
  });
});
