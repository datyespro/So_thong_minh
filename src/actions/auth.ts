"use server";

import { z } from "zod";
import { createClient } from "@/src/lib/supabase/server";
import type { ActionResult } from "@/src/types/action-result";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<{ userId: string }>> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Sai email hoặc mật khẩu",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return {
      ok: false,
      code: "invalid_credentials",
      message: "Sai email hoặc mật khẩu",
    };
  }

  return {
    ok: true,
    data: {
      userId: data.user.id,
    },
  };
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false,
      code: "internal",
      message: "Không thể đăng xuất. Vui lòng thử lại.",
    };
  }

  return {
    ok: true,
    data: undefined,
  };
}
