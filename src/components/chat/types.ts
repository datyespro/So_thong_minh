export type ChatRole = "user" | "assistant";

export type ChatMessageView = {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  metadata?: unknown;
  pending?: boolean;
  ephemeral?: boolean;
};
