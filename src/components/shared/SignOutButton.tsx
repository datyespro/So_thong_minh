"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "@/src/actions/auth";
import { Button } from "@/src/components/ui/button";

type SignOutButtonProps = Readonly<{
  compact?: boolean;
}>;

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={[
        "min-h-10 w-full rounded border-ledgerBorder bg-paper text-sm text-textMute shadow-none hover:bg-paperWarm hover:text-ink",
        compact ? "justify-center px-0" : "justify-start gap-2",
      ].join(" ")}
      onClick={handleSignOut}
      disabled={isPending}
      aria-label="Đăng xuất"
      title="Đăng xuất"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {compact ? null : isPending ? "Đang đăng xuất..." : "Đăng xuất"}
    </Button>
  );
}
