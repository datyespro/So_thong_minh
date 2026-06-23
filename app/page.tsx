import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import { LandingPage } from "@/src/components/landing/landing-page";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return <LandingPage />;
}
