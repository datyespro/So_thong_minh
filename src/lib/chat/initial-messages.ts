import type { ChatMessageView, ChatRole } from "@/src/components/chat/types";

export type ChatHistoryRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: unknown;
};

function isChatRole(role: string): role is ChatRole {
  return role === "user" || role === "assistant";
}

function toChatMessageView(row: ChatHistoryRow): ChatMessageView | null {
  if (!isChatRole(row.role)) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
    metadata: row.metadata,
  };
}

export function toInitialMessages(rows: readonly ChatHistoryRow[]) {
  return [...rows]
    .reverse()
    .map(toChatMessageView)
    .filter((message): message is ChatMessageView => message !== null);
}
