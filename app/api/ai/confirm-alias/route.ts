import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmAlias } from "@/src/lib/ai/alias-memory";
import { EntityTypeSchema } from "@/src/lib/ai/resolve-schema";
import { createClient } from "@/src/lib/supabase/server";

const requestSchema = z.object({
  entity_type: EntityTypeSchema,
  entity_id: z.string().min(1),
  alias: z.string(),
});

function statusForCode(code: string) {
  if (code === "unauthorized") {
    return 401;
  }

  if (code === "validation_failed") {
    return 400;
  }

  return 500;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        ok: false,
        code: "unauthorized",
        message: "Please log in.",
      },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_failed",
        message: "Invalid JSON body.",
      },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_failed",
        message: "Alias confirmation request is invalid.",
      },
      { status: 400 },
    );
  }

  const result = await confirmAlias({
    supabase,
    ownerId: user.id,
    entityType: parsed.data.entity_type,
    entityId: parsed.data.entity_id,
    alias: parsed.data.alias,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : statusForCode(result.code),
  });
}
