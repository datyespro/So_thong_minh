import { debtStanding } from "@/src/lib/customers/debt-standing";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { cn } from "@/src/lib/utils";

// VĐ3: hiển thị "standing" theo dấu của debt_total. Quyết định dấu CHỈ qua
// debtStanding (nguồn duy nhất); presentational thuần để test renderToStaticMarkup.
// Tách khỏi page.tsx vì Next 15 type-validator cấm named value-export trên page.

function coerceDebt(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Danh sách khách — ô "Số nợ".
export function DebtValue({
  value,
}: Readonly<{ value: number | string | null }>) {
  const numeric = coerceDebt(value);
  const standing = debtStanding(numeric);

  if (standing.kind === "credit") {
    return (
      <span className="font-mono font-semibold text-paid">
        Trả trước {formatVietnameseMoney(standing.amount)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "font-mono font-semibold",
        standing.kind === "debt" ? "text-debt" : "text-textMain",
      )}
    >
      {formatVietnameseMoney(numeric)}
    </span>
  );
}

// Trang khách — dòng số nợ to ở header.
export function DebtHeadline({
  debtTotal,
}: Readonly<{ debtTotal: number | string | null }>) {
  const numeric = coerceDebt(debtTotal);
  const standing = debtStanding(numeric);

  if (standing.kind === "credit") {
    return (
      <>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
          Khách trả trước
        </p>
        <p className="mt-2 font-mono text-[34px] font-bold leading-none text-paid sm:text-[40px]">
          {formatVietnameseMoney(standing.amount)}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
        Số nợ hiện tại
      </p>
      <p className="mt-2 font-mono text-[34px] font-bold leading-none text-debt sm:text-[40px]">
        {formatVietnameseMoney(numeric)}
      </p>
    </>
  );
}
