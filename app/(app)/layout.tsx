import { AuthGuard, getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { AppShell } from "@/src/components/shared/AppShell";
import { businessDateVN } from "@/src/lib/dayjs";
import { createClient } from "@/src/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const today = businessDateVN();
  const [profileResult, ordersResult, debtorsResult] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("business_date", today)
      .eq("status", "confirmed")
      .is("deleted_at", null),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gt("debt_total", 0)
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);

  const profile = profileResult.data;
  const todayOrderCount = ordersResult.count ?? 0;
  const debtorCount = debtorsResult.count ?? 0;

  if (ordersResult.error || debtorsResult.error) {
    console.warn("Failed to load app shell counts", {
      orders: ordersResult.error?.message,
      debtors: debtorsResult.error?.message,
    });
  }

  const displayName = profile?.name ?? user.email ?? "Người dùng";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "S";

  return (
    <AuthGuard>
      <AppShell
        displayName={displayName}
        email={user.email}
        avatarInitial={avatarInitial}
        todayOrderCount={todayOrderCount}
        debtorCount={debtorCount}
      >
        {children}
      </AppShell>
    </AuthGuard>
  );
}
