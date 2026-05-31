"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { signInAction } from "@/src/actions/auth";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const result = await signInAction({ email, password });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.replace("/chat");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <Label
          htmlFor="email"
          className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-textMute"
        >
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          className="h-12 rounded-none border-0 border-b border-ledgerBorder bg-transparent px-0 text-base text-textMain shadow-none placeholder:text-textFaint focus-visible:border-ink focus-visible:ring-0"
        />
      </div>

      <div>
        <Label
          htmlFor="password"
          className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-textMute"
        >
          Mật khẩu
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-12 rounded-none border-0 border-b border-ledgerBorder bg-transparent px-0 text-base text-textMain shadow-none placeholder:text-textFaint focus-visible:border-ink focus-visible:ring-0"
        />
      </div>

      <p
        className="flex min-h-[22px] items-center gap-2 text-sm font-medium text-debt"
        aria-live="polite"
      >
        {error ? (
          <>
            <span
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-current text-[10px]"
              aria-hidden="true"
            >
              !
            </span>
            {error}
          </>
        ) : null}
      </p>

      <Button
        type="submit"
        className="h-[52px] w-full rounded border border-inkDeep bg-ink text-base font-semibold tracking-normal text-paper shadow-[0_1px_0_var(--ink-deep),0_6px_16px_-6px_rgba(30,58,138,0.4)] hover:bg-inkDeep active:translate-y-px active:shadow-[var(--shadow-press)]"
        disabled={isPending}
      >
        {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>

      <div className="flex items-center justify-between border-t border-dashed border-ledgerBorder pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-textFaint">
          № 001 / mở sổ
        </span>
        <span className="font-display text-xs italic text-textFaint">v0.1</span>
      </div>
    </form>
  );
}
