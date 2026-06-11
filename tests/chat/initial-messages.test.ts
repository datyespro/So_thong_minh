import { describe, expect, it } from "vitest";
import {
  toInitialMessages,
  type ChatHistoryRow,
} from "@/src/lib/chat/initial-messages";

function row(
  id: string,
  role: string,
  content: string,
  metadata: unknown = null,
): ChatHistoryRow {
  return {
    id,
    role,
    content,
    created_at: `2026-06-11T09:00:0${id}.000Z`,
    metadata,
  };
}

describe("toInitialMessages", () => {
  it("reverses rows returned newest-first into chronological render order", () => {
    const messages = toInitialMessages([
      row("3", "user", "Tin moi nhat"),
      row("2", "assistant", "Tin thu hai"),
      row("1", "user", "Tin cu nhat"),
    ]);

    expect(messages.map((message) => message.id)).toEqual(["1", "2", "3"]);
  });

  it("preserves the old order and content for histories below the limit", () => {
    const chronologicalRows = [
      row("1", "user", "Tin dau"),
      row("2", "assistant", "Tin cuoi", {
        source: "tip_25a_capability",
        chips: ["Anh Hung tra 200k"],
      }),
    ];

    expect(toInitialMessages([...chronologicalRows].reverse())).toEqual([
      {
        id: "1",
        role: "user",
        content: "Tin dau",
        created_at: "2026-06-11T09:00:01.000Z",
        metadata: null,
      },
      {
        id: "2",
        role: "assistant",
        content: "Tin cuoi",
        created_at: "2026-06-11T09:00:02.000Z",
        metadata: {
          source: "tip_25a_capability",
          chips: ["Anh Hung tra 200k"],
        },
      },
    ]);
  });

  it("continues to filter rows with unsupported roles", () => {
    const messages = toInitialMessages([
      row("3", "assistant", "Tin moi"),
      row("2", "system", "Khong hien thi"),
      row("1", "user", "Tin cu"),
    ]);

    expect(messages.map((message) => message.id)).toEqual(["1", "3"]);
    expect(messages.map((message) => message.content)).not.toContain(
      "Khong hien thi",
    );
  });
});
