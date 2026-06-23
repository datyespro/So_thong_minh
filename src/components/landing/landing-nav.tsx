import Link from "next/link";

import { Button } from "@/src/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ledgerBorder/70 bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-inkDeep"
        >
          Sổ Thông Minh<span className="text-stamp">.</span>
        </Link>
        <Button asChild className="h-10 px-5 text-paper">
          <Link href="/login">Đăng nhập</Link>
        </Button>
      </div>
    </header>
  );
}
