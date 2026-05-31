import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/chat" : "/login");
}
