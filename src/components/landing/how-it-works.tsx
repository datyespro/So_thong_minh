import Link from "next/link";
import {
  CheckCircle2,
  Keyboard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Step = {
  n: string;
  icon: LucideIcon;
  title: string;
  text: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    icon: Keyboard,
    title: "Gõ",
    text: "Bạn gõ như đang nói: “Cô Lan trả 500k tiền gạch.”",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "AI dựng phiếu",
    text: "AI hiểu và dựng sẵn phiếu cho bạn xem. AI không tự ý ghi.",
  },
  {
    n: "03",
    icon: CheckCircle2,
    title: "Bấm Ghi",
    text: "Đúng rồi thì bấm Ghi. Nợ, tồn, doanh thu tự cập nhật.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="cach-hoat-dong"
      className="scroll-mt-20 bg-paperNote py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          data-anim="fade-up"
          className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp"
        >
          <span className="h-px w-6 bg-stamp" />
          Chỉ 3 bước
        </div>
        <h2
          data-anim="fade-up"
          className="max-w-2xl font-display text-3xl font-semibold leading-tight text-inkDeep sm:text-4xl"
        >
          Ba bước, xong một đơn.
        </h2>

        <div className="relative mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
          <div
            data-step-line
            className="absolute left-0 right-0 top-7 hidden h-px origin-left bg-borderStrong sm:block"
            aria-hidden="true"
          />
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.n} data-step className="relative">
                <div className="flex size-14 items-center justify-center rounded-full border border-borderStrong bg-paper shadow-sm">
                  <Icon className="size-6 text-ink" aria-hidden="true" />
                </div>
                <div className="mt-5 font-mono text-xs uppercase tracking-[0.2em] text-stamp">
                  Bước {step.n}
                </div>
                <h3 className="mt-1 font-display text-2xl font-semibold text-inkDeep">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-xs text-lg leading-relaxed text-textMute">
                  {step.text}
                </p>
              </div>
            );
          })}
        </div>

        <Link
          href="/login"
          data-anim="fade-up"
          className="mt-12 inline-flex items-center gap-2 text-lg font-medium text-ink underline-offset-4 hover:underline"
        >
          Mở sổ thử
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
