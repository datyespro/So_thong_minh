"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { BarChart3, MessageCircle, Package, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import { SignOutButton } from "@/src/components/shared/SignOutButton";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/products", label: "Sản phẩm", icon: Package },
  { href: "/reports", label: "Báo cáo", icon: BarChart3 },
];

type AppShellProps = Readonly<{
  children: React.ReactNode;
  displayName: string;
  email?: string;
  avatarInitial: string;
  todayOrderCount: number;
  debtorCount: number;
}>;

export function AppShell({
  children,
  displayName,
  email,
  avatarInitial,
  todayOrderCount,
  debtorCount,
}: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const pathname = usePathname();

  return (
    <div
      className={[
        // h-dvh + overflow-hidden: the app shell is exactly the visible viewport
        // and never scrolls as a whole. dvh (not vh) so the iPhone Safari toolbar
        // can't push the pinned chat input out of reach.
        "h-dvh overflow-hidden bg-paper text-textMain transition-[grid-template-columns] duration-300 ease-out md:grid",
        collapsed ? "md:grid-cols-[76px_1fr]" : "md:grid-cols-[264px_1fr]",
      ].join(" ")}
    >
      <aside
        className={[
          "paper-grain relative hidden h-full flex-col overflow-x-hidden overflow-y-auto border-r border-ledgerBorder bg-paperWarm pb-5 pt-7 transition-[padding,width] duration-300 ease-out md:flex",
          collapsed ? "w-[76px] px-3" : "w-[264px] px-4",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-ledgerBorder bg-surface/90 text-textMute shadow-sm transition-colors hover:bg-paper hover:text-ink"
          aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <div className={["pb-6 transition-[padding] duration-300", collapsed ? "px-0" : "px-2"].join(" ")}>
          <div
            className={[
              "mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-stamp transition-opacity duration-200",
              collapsed ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            sổ điện tử
          </div>
          <Link
            href="/chat"
            className={[
              "block overflow-hidden font-display font-semibold leading-tight tracking-normal text-inkDeep transition-[font-size,width] duration-300",
              collapsed ? "w-11 text-center text-xl" : "w-full text-[22px]",
            ].join(" ")}
            title="Sổ Thông Minh"
          >
            {collapsed ? "Sổ" : "Sổ Thông Minh"}
            {collapsed ? null : <span className="text-stamp">.</span>}
          </Link>
          <div className="mt-3.5 h-px bg-borderStrong" />
        </div>

        <nav className={["flex flex-col gap-1 transition-[padding] duration-300", collapsed ? "pl-0" : "pl-2"].join(" ")}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={[
                  "relative flex h-12 items-center rounded text-[15px] transition-[background-color,color,gap,padding] duration-300",
                  collapsed ? "justify-center gap-0 px-0" : "gap-3.5 px-4",
                  active
                    ? "bg-ink font-medium text-paper shadow-[inset_0_1px_2px_rgba(0,0,0,0.15),0_1px_0_rgba(30,58,138,0.3)]"
                    : "text-textMain hover:bg-ink/5 hover:text-ink",
                ].join(" ")}
              >
                {active ? (
                  <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-stamp" />
                ) : null}
                <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden="true" />
                <span
                  className={[
                    "overflow-hidden whitespace-nowrap transition-[opacity,width,transform] duration-200",
                    collapsed ? "w-0 translate-x-2 opacity-0" : "w-auto translate-x-0 opacity-100",
                  ].join(" ")}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div
          className={[
            "mt-6 flex items-center gap-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-textFaint transition-opacity duration-200",
            collapsed ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          hôm nay
          <span className="h-px flex-1 bg-ledgerBorder" />
        </div>

        <div
          className={[
            "mt-2 overflow-hidden rounded border border-ledgerBorder bg-surface text-[13px] leading-6 text-textMute transition-[max-height,opacity,padding] duration-300",
            collapsed ? "max-h-0 p-0 opacity-0" : "max-h-28 px-3.5 py-3 opacity-100",
          ].join(" ")}
        >
          <div className="flex justify-between">
            <span>Đơn ghi</span>
            <span className="font-mono font-semibold text-textMain">
              {todayOrderCount}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Khách nợ</span>
            <span className="font-mono font-semibold text-debt">
              {debtorCount}
            </span>
          </div>
        </div>

        <div className="flex-1" />

        <div
          className={[
            "rounded border border-ledgerBorder bg-surface transition-[padding] duration-300",
            collapsed ? "p-2" : "p-3",
          ].join(" ")}
        >
          <div className={["mb-3 flex items-center transition-[gap] duration-300", collapsed ? "justify-center gap-0" : "gap-3"].join(" ")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-semibold text-paper">
              {avatarInitial}
            </div>
            <div
              className={[
                "min-w-0 overflow-hidden transition-[opacity,width,transform] duration-200",
                collapsed ? "w-0 translate-x-2 opacity-0" : "w-full translate-x-0 opacity-100",
              ].join(" ")}
            >
              <p className="truncate text-sm font-semibold text-textMain">{displayName}</p>
              <p className="truncate text-xs text-textMute">{email}</p>
            </div>
          </div>
          <SignOutButton compact={collapsed} />
        </div>
      </aside>

      <div className="flex h-full min-h-0 flex-col">
        <header className="border-b border-ledgerBorder bg-paperWarm px-4 py-3 md:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link href="/chat" className="font-display text-xl font-semibold text-inkDeep">
              Sổ Thông Minh<span className="text-stamp">.</span>
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-display text-base font-semibold text-paper">
              {avatarInitial}
            </div>
          </div>
          <nav className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex min-h-11 flex-col items-center justify-center gap-1 rounded text-xs font-semibold",
                    active ? "bg-ink text-paper" : "text-textMute hover:bg-ink/5 hover:text-ink",
                  ].join(" ")}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
