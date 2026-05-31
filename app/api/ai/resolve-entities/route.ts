import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveEntities,
} from "@/src/lib/ai/resolve-entities";
import { EntityResolveError } from "@/src/lib/ai/resolve-errors";
import { ExtractedIntentSchema } from "@/src/lib/ai/intent-schema";
import { createClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  intent: ExtractedIntentSchema,
});

const errorMessages: Record<EntityResolveError["code"], string> = {
  EMPTY_INTENT: "Intent is required.",
  OWNER_FETCH_FAILED: "Could not fetch owner entities.",
  RESOLVE_FAILED: "Could not resolve entities.",
};

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
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
    return errorResponse("EMPTY_INTENT", "Intent is required.", 400);
  }

  try {
    const resolved = await resolveEntities({
      intent: parsed.data.intent,
      ownerId: user.id,
      supabase,
    });

    return NextResponse.json({
      ok: true,
      data: resolved,
    });
  } catch (error) {
    if (error instanceof EntityResolveError) {
      const status = error.code === "EMPTY_INTENT" ? 400 : 500;

      return errorResponse(error.code, errorMessages[error.code], status);
    }

    return errorResponse("RESOLVE_FAILED", "Could not resolve entities.", 500);
  }
}
