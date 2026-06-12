import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatPipelineResult } from "@/src/lib/ai/chat-pipeline";

type InteractionLogSupabaseClient = Pick<SupabaseClient, "from">;
type SuccessfulPipeline = Extract<ChatPipelineResult, { ok: true }>;
type InteractionOutcome = "proposed" | "answered" | "none" | "error";

function outcomeForPipeline(pipeline: SuccessfulPipeline): InteractionOutcome {
  if (pipeline.validated.kind === "query") {
    return "answered";
  }

  if (
    pipeline.validated.kind === "none" &&
    (pipeline.validated.intent === "small_talk" ||
      pipeline.validated.intent === "unknown")
  ) {
    return "none";
  }

  return "proposed";
}

export async function logAiInteraction({
  supabase,
  ownerId,
  rawText,
  pipeline,
  latencyMs,
}: {
  supabase: InteractionLogSupabaseClient;
  ownerId: string;
  rawText: string;
  pipeline: ChatPipelineResult;
  latencyMs: number;
}): Promise<string> {
  const turnId = crypto.randomUUID();
  const successful = pipeline.ok;

  try {
    const { error } = await supabase.from("ai_interactions").insert({
      turn_id: turnId,
      owner_id: ownerId,
      raw_text: rawText,
      intent: successful ? pipeline.validated.intent : null,
      confidence: successful ? (pipeline.extracted.confidence ?? null) : null,
      extracted: successful ? pipeline.extracted : null,
      validated: successful ? pipeline.validated : null,
      model_version: process.env.AI_MODEL ?? "gpt-4.1-mini",
      latency_ms: latencyMs,
      outcome: successful ? outcomeForPipeline(pipeline) : "error",
      error_stage: successful ? null : pipeline.stage,
    });

    if (error) {
      console.warn("Failed to log AI interaction", {
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.warn("Failed to log AI interaction", error);
  }

  return turnId;
}

export async function updateAiInteractionOutcome({
  supabase,
  ownerId,
  aiTurnId,
  outcome,
}: {
  supabase: InteractionLogSupabaseClient;
  ownerId: string;
  aiTurnId: string | null | undefined;
  outcome: "committed" | "dismissed" | "undone";
}): Promise<void> {
  if (!aiTurnId) {
    return;
  }

  try {
    const { error } = await supabase
      .from("ai_interactions")
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
      })
      .eq("owner_id", ownerId)
      .eq("turn_id", aiTurnId);

    if (error) {
      console.warn("Failed to update AI interaction outcome", {
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.warn("Failed to update AI interaction outcome", error);
  }
}
