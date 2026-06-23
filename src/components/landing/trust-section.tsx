import { Eye, ShieldCheck, Undo2, type LucideIcon } from "lucide-react";

type TrustPoint = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const POINTS: TrustPoint[] = [
  {
    icon: ShieldCheck,
    title: "Không bịa số",
    text: "Mọi con số lấy từ dữ liệu thật của cửa hàng bạn.",
  },
  {
    icon: Eye,
    title: "Xem trước rồi mới ghi",
    text: "Bạn bấm Ghi thì AI mới lưu — không tự ý.",
  },
  {
    icon: Undo2,
    title: "Lỡ sai sửa được",
    text: "Hoàn tác dễ dàng, không sợ hỏng sổ.",
  },
];

function ApprovalStamp() {
  return (
    <svg
      width="160"
      height="160"
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
      data-stamp
      className="rotate-[-8deg] text-stamp"
    >
      <rect
        x="6"
        y="6"
        width="148"
        height="148"
        rx="6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        opacity="0.6"
      />
      <rect
        x="16"
        y="16"
        width="128"
        height="128"
        rx="4"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.8"
      />
      <text
        x="80"
        y="60"
        textAnchor="middle"
        fontSize="15"
        fontWeight="600"
        letterSpacing="3"
        fill="currentColor"
        className="font-mono"
      >
        SỔ THÔNG MINH
      </text>
      <text
        x="80"
        y="98"
        textAnchor="middle"
        fontSize="30"
        fontWeight="700"
        fill="currentColor"
        className="font-display"
      >
        ĐÃ DUYỆT
      </text>
      <text
        x="80"
        y="124"
        textAnchor="middle"
        fontSize="11"
        letterSpacing="2"
        fill="currentColor"
        opacity="0.85"
        className="font-mono"
      >
        BẠN BẤM · AI GHI
      </text>
    </svg>
  );
}

export function TrustSection() {
  return (
    <section className="bg-paperWarm py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <div>
          <div
            data-anim="fade-up"
            className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-stamp"
          >
            <span className="h-px w-6 bg-stamp" />
            Yên tâm
          </div>
          <h2
            data-anim="fade-up"
            className="max-w-xl font-display text-3xl font-semibold leading-tight text-inkDeep sm:text-4xl"
          >
            AI đề xuất — <span className="italic">bạn</span> là người quyết.
          </h2>

          <ul className="mt-10 space-y-6">
            {POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <li key={point.title} data-anim="fade-up" className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface shadow-sm">
                    <Icon className="size-6 text-paid" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-textMain">
                      {point.title}
                    </h3>
                    <p className="mt-0.5 leading-relaxed text-textMute">
                      {point.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="flex size-64 items-center justify-center rounded-2xl border border-borderStrong bg-paper shadow-[var(--shadow-card)]">
            <ApprovalStamp />
          </div>
        </div>
      </div>
    </section>
  );
}
