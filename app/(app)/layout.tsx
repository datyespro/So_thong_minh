import { AuthGuard, getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { AppShell } from "@/src/components/shared/AppShell";
import { createClient } from "@/src/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.name ?? user.email ?? "Người dùng";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <AuthGuard>
      <AppShell displayName={displayName} email={user.email} avatarInitial={avatarInitial}>
        {children}
      </AppShell>
    </AuthGuard>
  );
}
