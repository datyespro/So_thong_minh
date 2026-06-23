import { extractIntent } from "@/src/lib/ai/extract-intent";
import {
  resolveEntities,
  type EntitySupabaseClient,
} from "@/src/lib/ai/resolve-entities";
import {
  validateIntent,
  type ValidateSupabaseClient,
} from "@/src/lib/ai/validate-intent";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";

const WRITABLE_LEDGER_INTENTS = new Set<ExtractedIntent["intent"]>([
  "create_order",
  "record_payment",
  "create_purchase",
]);
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;

export type ChatPipelineResult =
  | { ok: true; extracted: ExtractedIntent; validated: ValidatedIntent }
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

export function guardSymbolOnlyWritableIntent(
  extracted: ExtractedIntent,
): ExtractedIntent {
  const rawText = extracted.raw_text.trim();

  if (
    !WRITABLE_LEDGER_INTENTS.has(extracted.intent) ||
    LETTER_OR_NUMBER_RE.test(rawText)
  ) {
    return extracted;
  }

  return {
    ...extracted,
    intent: "unknown",
    confidence: 0,
    entities: {
      customer_name: null,
      supplier_name: null,
      product_name: null,
      product_management: null,
      customer_management: null,
      items: [],
      amount: null,
      paid_amount: null,
      payment_status: "unknown",
      payment_method: null,
      payment_scope_raw: null,
      order_reference: null,
      business_date: null,
      time_range: {
        raw: null,
        kind: "unknown",
        start_date: null,
        end_date: null,
      },
    },
    missing_info: [],
    warnings: [...extracted.warnings, "ignored_symbol_only_input"],
    needs_confirmation: false,
    next_stage_hint: "reject",
  };
}

export async function runChatPipeline({
  rawText,
  ownerId,
  supabase,
}: RunChatPipelineInput): Promise<ChatPipelineResult> {
  let extracted: ExtractedIntent;

  try {
    extracted = await extractIntent({
      rawText,
      ownerId,
    });
    extracted = guardSymbolOnlyWritableIntent(extracted);
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
      extracted,
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
