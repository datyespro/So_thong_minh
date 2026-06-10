import { ChatContainer } from "@/src/components/chat/chat-container";
import type { ChatMessageView, ChatRole } from "@/src/components/chat/types";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { createClient } from "@/src/lib/supabase/server";

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

type ChatHistoryRow = {
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

function getVietnamHour(date: Date) {
  const hour = new Intl.DateTimeFormat("vi-VN", {
    hour: "numeric",
    hour12: false,
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);

  return Number.parseInt(hour, 10);
}

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 11) {
    return "Chào buổi sáng.";
  }

  if (hour >= 11 && hour < 14) {
    return "Chào buổi trưa.";
  }

  if (hour >= 14 && hour < 18) {
    return "Chào buổi chiều.";
  }

  return "Chào buổi tối.";
}

function getTodayLabel(date: Date) {
  const formatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: VIETNAM_TIME_ZONE,
  }).format(date);

  return `Hôm nay là ${formatted}`;
}

export default async function ChatPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const now = new Date();

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,role,content,created_at,metadata")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.warn("Failed to load chat history", {
      code: error.code,
      message: error.message,
    });
  }

  const initialMessages = ((data ?? []) as ChatHistoryRow[])
    .map(toChatMessageView)
    .filter((message): message is ChatMessageView => message !== null);

  return (
    <ChatContainer
      greeting={getGreeting(getVietnamHour(now))}
      initialMessages={initialMessages}
      ownerId={user.id}
      todayLabel={getTodayLabel(now)}
    />
  );
}
