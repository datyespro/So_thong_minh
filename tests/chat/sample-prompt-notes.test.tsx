import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SAMPLE_PROMPTS,
  SamplePromptNotes,
} from "@/src/components/chat/sample-prompt-notes";

describe("SamplePromptNotes", () => {
  it("renders four sample prompt buttons", () => {
    const html = renderToStaticMarkup(
      createElement(SamplePromptNotes, {
        onPick: () => undefined,
      }),
    );

    for (const prompt of SAMPLE_PROMPTS) {
      expect(html).toContain(prompt.tag);
      expect(html).toContain(prompt.text);
      expect(html).toContain(`Dùng mẫu: ${prompt.text}`);
    }
  });
});
