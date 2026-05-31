import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function AuthGuard({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await getAuthenticatedUser();

  return <>{children}</>;
}
