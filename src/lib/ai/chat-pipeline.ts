import { extractIntent } from "@/src/lib/ai/extract-intent";
import {
  resolveEntities,
  type EntitySupabaseClient,
} from "@/src/lib/ai/resolve-entities";
import {
  validateIntent,
  type ValidateSupabaseClient,
} from "@/src/lib/ai/validate-intent";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";

export type ChatPipelineResult =
  | { ok: true; validated: ValidatedIntent }
  | {
      ok: false;
      stage: "extract" | "resolve" | "validate";
      code: string;
      message: string;
    };

export type RunChatPipelineInput = {
  rawText: string;
  ownerId: string;
  supabase: EntitySupabaseClient & ValidateSupabaseClient;
};

export async function runChatPipeline({
  rawText,
  ownerId,
  supabase,
}: RunChatPipelineInput): Promise<ChatPipelineResult> {
  let extracted;

  try {
    extracted = await extractIntent({
      rawText,
      ownerId,
    });
  } catch (error) {
    console.error("Chat pipeline extract failed", {
      ownerId,
      rawTextLength: rawText.length,
      error,
    });

    return {
      ok: false,
      stage: "extract",
      code: "extract_failed",
      message: "Em chưa đọc được câu này, bác thử nói lại gọn hơn giúp em ạ.",
    };
  }

  let resolved;

  try {
    resolved = await resolveEntities({
      intent: extracted,
      ownerId,
      supabase,
    });
  } catch (error) {
    console.error("Chat pipeline resolve failed", {
      ownerId,
      intent: extracted.intent,
      error,
    });

    return {
      ok: false,
      stage: "resolve",
      code: "resolve_failed",
      message: "Em chưa tra được tên trong câu, bác thử lại ạ.",
    };
  }

  try {
    const validated = await validateIntent({
      resolved,
      ownerId,
      supabase,
    });

    return {
      ok: true,
      validated,
    };
  } catch (error) {
    console.error("Chat pipeline validate failed", {
      ownerId,
      intent: resolved.intent,
      error,
    });

    return {
      ok: false,
      stage: "validate",
      code: "validate_failed",
      message: "Em chưa kiểm được đơn, bác thử lại ạ.",
    };
  }
}
