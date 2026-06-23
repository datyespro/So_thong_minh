import {
  BarChart3,
  Boxes,
  HandCoins,
  PackagePlus,
  Receipt,
  Undo2,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const FEATURES: Feature[] = [
  {
    icon: HandCoins,
    title: "Tra công nợ",
    text: "“Anh Hùng nợ bao nhiêu?” — trả lời tức thì, số từ dữ liệu thật.",
  },
  {
    icon: Receipt,
    title: "Ghi đơn bán",
    text: "Một câu thành đơn, kèm trả ngay hay còn nợ.",
  },
  {
    icon: PackagePlus,
    title: "Ghi nhập hàng",
    text: "Nhập kho, tồn tự cộng.",
  },
  {
    icon: Boxes,
    title: "Tồn kho",
    text: "Còn bao nhiêu, cảnh báo khi tồn âm.",
  },
  {
    icon: BarChart3,
    title: "Báo cáo",
    text: "“Hôm nay bán bao nhiêu?” — tổng kết ngay.",
  },
  {
    icon: Undo2,
    title: "Hoàn tác & sửa",
    text: "Ghi nhầm? Hoàn tác một chạm.",
  },
];

export function Features() {
  return (
    <section className="bg-paper py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          data-anim="fade-up"
          className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp"
        >
          <span className="h-px w-6 bg-stamp" />
          Thay trọn quyển sổ
        </div>
        <h2
          data-anim="fade-up"
          className="max-w-2xl font-display text-3xl font-semibold leading-tight text-inkDeep sm:text-4xl"
        >
          Mọi việc của sổ giấy, gọn trong một câu.
        </h2>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                data-anim="fade-up"
                className="rounded-xl border border-ledgerBorder bg-surface p-6 shadow-sm transition-shadow hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-paperWarm">
                  <Icon className="size-6 text-ink" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-textMain">
                  {feature.title}
                </h3>
                <p className="mt-1 leading-relaxed text-textMute">
                  {feature.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
