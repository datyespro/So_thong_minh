import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractIntent,
  IntentExtractionError,
} from "@/src/lib/ai/extract-intent";
import { createClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  text: z.string(),
});

const errorMessages: Record<IntentExtractionError["code"], string> = {
  EMPTY_INPUT: "Message is required.",
  INPUT_TOO_LONG: "Message is too long.",
  AI_CONFIG_MISSING: "OPENAI_API_KEY is not configured.",
  INTENT_EXTRACTION_FAILED: "Could not extract intent.",
};

function errorResponse(
  code:
    | IntentExtractionError["code"]
    | "UNAUTHORIZED"
    | "INVALID_REQUEST",
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("UNAUTHORIZED", "Please log in.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Invalid JSON body.", 400);
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("EMPTY_INPUT", "Message is required.", 400);
  }

  const rawText = parsed.data.text;

  try {
    const extracted = await extractIntent({
      rawText,
      ownerId: user.id,
    });

    const logResult = await supabase.from("chat_messages").insert([
      {
        owner_id: user.id,
        role: "user",
        content: rawText.trim(),
        intent: null,
        metadata: { source: "api/ai/extract-intent" },
      },
      {
        owner_id: user.id,
        role: "assistant",
        content: `Đã nhận diện: ${extracted.intent}`,
        intent: extracted.intent,
        metadata: {
          source: "stage_1_extract_intent",
          extracted,
          confidence: extracted.confidence,
        },
      },
    ]);

    if (logResult.error) {
      console.warn("Failed to log extract-intent chat messages", {
        code: logResult.error.code,
        message: logResult.error.message,
      });
    }

    return NextResponse.json({
      ok: true,
      data: extracted,
    });
  } catch (error) {
    if (error instanceof IntentExtractionError) {
      const status = error.code === "AI_CONFIG_MISSING" ? 500 : 400;
      return errorResponse(error.code, errorMessages[error.code], status);
    }

    console.error("Unexpected extract-intent route error");
    return errorResponse(
      "INTENT_EXTRACTION_FAILED",
      "Could not extract intent.",
      500,
    );
  }
}
