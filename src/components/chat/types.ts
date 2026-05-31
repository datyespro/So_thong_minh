export type ChatRole = "user" | "assistant";

export type ChatMessageView = {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  pending?: boolean;
  ephemeral?: boolean;
};
