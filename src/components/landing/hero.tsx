import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Button } from "@/src/components/ui/button";

function OrderCardDemo() {
  return (
    <div
      data-hero-card
      className="rounded-lg border border-ledgerBorder bg-surface p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-inkDeep">
          Anh Hùng
        </span>
        <span className="rounded bg-paperWarm px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-stamp">
          Đơn bán
        </span>
      </div>
      <div className="flex items-center justify-between border-b border-dashed border-ledgerBorder pb-2 text-[15px] text-textMain">
        <span>20 bao xi măng</span>
        <span className="font-mono text-textMute">× 80.000đ</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm text-textMute">Tổng tiền</span>
        <span className="font-mono text-2xl font-semibold text-inkDeep">
          1.600.000đ
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-paid">Đã trả 1.000.000đ</span>
        <span className="font-semibold text-debt">Còn nợ 600.000đ</span>
      </div>
      <div className="mt-4 w-full rounded-md bg-ink py-2.5 text-center font-medium text-paper">
        Ghi
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative w-[300px] max-w-full sm:w-[340px]">
      <div className="rounded-[2.5rem] border-[10px] border-inkDeep bg-inkDeep shadow-[var(--shadow-card)]">
        <div className="overflow-hidden rounded-[1.8rem] bg-paper">
          <div className="flex items-center justify-between border-b border-ledgerBorder px-4 py-3">
            <span className="font-display text-base font-semibold text-inkDeep">
              Sổ Thông Minh
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-textFaint">
              Chat
            </span>
          </div>
          <div className="space-y-4 px-4 py-5">
            <div className="flex justify-end">
              <p
                data-hero-bubble
                className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[15px] leading-snug text-paper"
              >
                Anh Hùng mua 20 bao xi măng 80k, trả 1 triệu
              </p>
            </div>
            <OrderCardDemo />
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="paper-grain relative overflow-hidden bg-paper pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="ledger-rules pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <div>
          <div
            data-hero-fade
            className="mb-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp"
          >
            <span className="h-px w-6 bg-stamp" />
            Trợ lý ghi sổ bằng tiếng Việt
          </div>
          <h1
            data-hero-title
            className="font-display text-4xl font-semibold leading-[1.05] text-inkDeep sm:text-5xl lg:text-6xl"
          >
            Gõ một câu,
            <br />
            sổ tự ghi xong<span className="text-stamp">.</span>
          </h1>
          <p
            data-hero-fade
            className="mt-6 max-w-xl text-lg leading-relaxed text-textMute sm:text-xl"
          >
            Sổ Thông Minh thay quyển sổ giấy: bạn gõ kiểu nói chuyện, AI ghi đơn,
            cộng nợ, và trả lời ngay “khách này nợ bao nhiêu” — số lấy từ chính
            cửa hàng của bạn.
          </p>
          <div
            data-hero-fade
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              asChild
              className="h-14 rounded-md px-8 text-lg text-paper shadow-[var(--shadow-card)] [&_svg]:!size-5"
            >
              <Link href="/login">
                Mở sổ ngay
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-14 px-5 text-lg text-ink hover:bg-paperWarm [&_svg]:!size-5"
            >
              <Link href="#cach-hoat-dong">
                Xem cách hoạt động
                <ArrowDown />
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneMock />
        </div>
      </div>
    </section>
  );
}
