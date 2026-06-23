import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/src/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-inkDeep py-24 text-paper">
      <div
        className="ledger-rules pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <h2
          data-anim="fade-up"
          className="font-display text-3xl font-semibold leading-tight text-paper sm:text-5xl"
        >
          Sẵn sàng bỏ sổ giấy chưa?
        </h2>
        <p
          data-anim="fade-up"
          className="mx-auto mt-4 max-w-xl text-lg text-paper/75 sm:text-xl"
        >
          Mở Sổ Thông Minh và gõ câu đầu tiên hôm nay.
        </p>
        <div data-anim="fade-up" className="mt-9 flex justify-center">
          <Button
            asChild
            className="h-14 bg-stamp px-9 text-lg text-paper shadow-[var(--shadow-card)] hover:bg-stamp/90 [&_svg]:!size-5"
          >
            <Link href="/login">
              Mở sổ / Đăng nhập
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
