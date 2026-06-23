import { Calculator, ClipboardList, Wallet, type LucideIcon } from "lucide-react";

type Pain = {
  icon: LucideIcon;
  figure: number;
  suffix: string;
  unit: string;
  title: string;
  text: string;
};

const PAINS: Pain[] = [
  {
    icon: Wallet,
    figure: 10,
    suffix: "",
    unit: "lần/ngày",
    title: "Tra công nợ",
    text: "Khách hỏi “tôi còn nợ bao nhiêu?”, bạn lật sổ dò lại — tới chục lần mỗi ngày.",
  },
  {
    icon: ClipboardList,
    figure: 30,
    suffix: "",
    unit: "đơn/ngày",
    title: "Ghi lúc đông khách",
    text: "Cao điểm ghi tay không kịp — sót một đơn là mất tiền thật.",
  },
  {
    icon: Calculator,
    figure: 100,
    suffix: "%",
    unit: "thủ công",
    title: "Tính toán bằng tay",
    text: "Cộng trừ công nợ thủ công, nhầm lẫn lúc nào không hay.",
  },
];

export function PainSection() {
  return (
    <section className="bg-paperWarm py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          data-anim="fade-up"
          className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp"
        >
          <span className="h-px w-6 bg-stamp" />
          Vì sao cần
        </div>
        <h2
          data-anim="fade-up"
          className="max-w-2xl font-display text-3xl font-semibold leading-tight text-inkDeep sm:text-4xl"
        >
          Lúc đông khách, sổ giấy đuối.
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PAINS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                data-anim="fade-up"
                className="rounded-xl border border-ledgerBorder bg-surface p-6 shadow-sm"
              >
                <Icon className="size-7 text-stamp" aria-hidden="true" />
                <div className="mt-4 flex items-baseline gap-2">
                  <span
                    className="font-mono text-5xl font-bold text-debt sm:text-6xl"
                    data-counter={p.figure}
                    data-suffix={p.suffix}
                  >
                    {p.figure}
                    {p.suffix}
                  </span>
                  <span className="font-mono text-sm text-debt/80">{p.unit}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-textMain">
                  {p.title}
                </h3>
                <p className="mt-1 leading-relaxed text-textMute">{p.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
