import { Card, CardContent } from "@/src/components/ui/card";
import { LoginForm } from "@/src/components/auth/LoginForm";

function StampMark({ className = "" }: { className?: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2"
        y="2"
        width="52"
        height="52"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        opacity="0.65"
      />
      <rect
        x="6"
        y="6"
        width="44"
        height="44"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.75"
      />
      <text
        x="28"
        y="22"
        textAnchor="middle"
        fontSize="6.5"
        fontWeight="600"
        letterSpacing="1.2"
        fill="currentColor"
        className="font-mono"
      >
        SỔ ĐIỆN TỬ
      </text>
      <text
        x="28"
        y="36"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="currentColor"
        className="font-display"
      >
        28.05
      </text>
      <text
        x="28"
        y="46"
        textAnchor="middle"
        fontSize="5.5"
        letterSpacing="0.8"
        fill="currentColor"
        opacity="0.85"
        className="font-mono"
      >
        MMXXVI
      </text>
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="paper-grain relative min-h-[calc(100vh-4rem)] w-full overflow-hidden bg-paper text-textMain md:min-h-[calc(100vh-5rem)]">
      <div className="ledger-rules pointer-events-none absolute inset-0 opacity-60" />

      <div className="absolute left-6 top-6 hidden items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp md:flex">
        <span className="h-px w-6 bg-stamp" />
        Trang № 001
      </div>

      <div className="absolute right-6 top-6 hidden flex-col items-end font-mono text-[11px] uppercase tracking-[0.15em] text-textFaint md:flex">
        <span>Thứ Năm · 28.05.2026</span>
        <span className="mt-2 h-px w-20 bg-borderStrong" />
      </div>

      <div className="absolute bottom-6 left-6 hidden font-mono text-[11px] tracking-[0.05em] text-textFaint md:block">
        v0.1 · Sổ Thông Minh.
      </div>
      <div className="absolute bottom-6 right-6 hidden font-display text-sm italic text-textFaint md:block">
        — 1 —
      </div>

      <div className="relative grid min-h-[calc(100vh-4rem)] w-full items-center gap-8 px-4 py-8 sm:px-8 md:grid-cols-[1.15fr_0.85fr] md:px-16 lg:px-24">
        <section className="hidden pt-5 md:block">
          <h1 className="font-display text-[72px] font-medium leading-[0.98] tracking-normal text-inkDeep lg:text-[92px]">
            Sổ Thông
            <br />
            Minh<span className="text-stamp">.</span>
          </h1>

          <p className="mt-7 max-w-sm font-display text-2xl italic leading-snug text-textMute">
            Bỏ sổ giấy.
            <br />
            Gõ một câu.
          </p>

          <div className="my-9 h-px w-20 bg-borderStrong" />

          <p className="max-w-[420px] text-[15px] leading-7 text-textMute">
            Sổ ghi nợ — ghi hàng — báo cáo cho cửa hàng nhỏ. Gõ một câu, sổ tự ghi.
            Khách nợ bao nhiêu, hàng còn bao nhiêu.
          </p>
        </section>

        <section className="flex justify-center md:justify-end">
          <Card className="relative w-full max-w-[420px] rounded border border-ledgerBorder bg-surface text-textMain shadow-[var(--shadow-card)]">
            <CardContent className="p-7 sm:p-10 md:px-12 md:py-11">
              <StampMark className="absolute right-5 top-5 hidden rotate-[-6deg] text-stamp sm:block" />

              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-textFaint">
                Mở sổ
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-normal text-inkDeep">
                Đăng nhập
              </h2>
              <div className="mb-7 mt-3.5 h-0.5 w-8 bg-ink" />

              <LoginForm />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
