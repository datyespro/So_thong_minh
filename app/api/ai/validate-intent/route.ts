import { NextResponse } from "next/server";
import { z } from "zod";
import { ResolvedIntentSchema } from "@/src/lib/ai/resolve-schema";
import { validateIntent } from "@/src/lib/ai/validate-intent";
import { ValidateError } from "@/src/lib/ai/validate-errors";
import { createClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  resolved: ResolvedIntentSchema,
});

const errorMessages: Record<ValidateError["code"], string> = {
  INVALID_INPUT: "Resolved intent is required.",
  MASTER_FETCH_FAILED: "Could not fetch validation data.",
  VALIDATE_FAILED: "Could not validate intent.",
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
    return errorResponse("INVALID_INPUT", "Resolved intent is required.", 400);
  }

  try {
    const validated = await validateIntent({
      resolved: parsed.data.resolved,
      ownerId: user.id,
      supabase,
    });

    return NextResponse.json({
      ok: true,
      data: validated,
    });
  } catch (error) {
    if (error instanceof ValidateError) {
      const status = error.code === "INVALID_INPUT" ? 400 : 500;

      return errorResponse(error.code, errorMessages[error.code], status);
    }

    return errorResponse("VALIDATE_FAILED", "Could not validate intent.", 500);
  }
}
