"use server";

import type { ActionResult } from "@/src/types/action-result";
import type { ChatMessageView } from "@/src/components/chat/types";
import {
  runChatPipeline,
  type ChatPipelineResult,
} from "@/src/lib/ai/chat-pipeline";
import { createClient } from "@/src/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 2000;

type InsertedChatRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type CustomerRow = {
  id: string;
  name: string;
};

export type CreatedCustomerView = CustomerRow;

export type ProcessMessageResult =
  | {
      ok: true;
      userMessage: ChatMessageView;
      pipeline: ChatPipelineResult;
    }
  | { ok: false; code: string; message: string };

function toUserMessage(row: InsertedChatRow): ChatMessageView {
  return {
    id: row.id,
    role: "user",
    content: row.content,
    created_at: row.created_at,
  };
}

function normalizeCustomerName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function findCustomerByName(rows: CustomerRow[] | null, name: string) {
  const normalized = normalizeCustomerName(name);

  return (rows ?? []).find(
    (row) => normalizeCustomerName(row.name) === normalized,
  ) ?? null;
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true
  );
}

export async function sendMessage(
  content: string,
): Promise<ActionResult<ChatMessageView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof content !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Bác chưa nhập gì ạ.",
    };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Bác chưa nhập gì ạ.",
    };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tin hơi dài, bác rút gọn dưới 2000 chữ giúp em ạ.",
    };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      owner_id: user.id,
      role: "user",
      content: trimmed,
      intent: null,
      metadata: { source: "chat_ui_scaffold" },
    })
    .select("id,role,content,created_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa lưu được tin, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: toUserMessage(data as InsertedChatRow),
  };
}

export async function createCustomer(
  name: string,
): Promise<ActionResult<CreatedCustomerView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const existingRead = await supabase
    .from("customers")
    .select("id,name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được khách, bác thử lại ạ.",
    };
  }

  const existing = findCustomerByName(
    existingRead.data as CustomerRow[] | null,
    trimmed,
  );

  if (existing) {
    return {
      ok: true,
      data: existing,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      name: trimmed,
    })
    .select("id,name")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const retryRead = await supabase
        .from("customers")
        .select("id,name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!retryRead.error) {
        const duplicate = findCustomerByName(
          retryRead.data as CustomerRow[] | null,
          trimmed,
        );

        if (duplicate) {
          return {
            ok: true,
            data: duplicate,
          };
        }
      }

      return {
        ok: false,
        code: "validation_failed",
        message: "Khách này có rồi ạ.",
      };
    }

    return {
      ok: false,
      code: "db_error",
      message: "Chưa thêm được khách, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: data as CustomerRow,
  };
}

export async function processMessage(
  content: string,
): Promise<ProcessMessageResult> {
  const saved = await sendMessage(content);

  if (!saved.ok) {
    return saved;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  const pipeline = await runChatPipeline({
    rawText: saved.data.content,
    ownerId: user.id,
    supabase,
  });

  return {
    ok: true,
    userMessage: saved.data,
    pipeline,
  };
}
