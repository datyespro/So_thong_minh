import { reconciliationFinalLine } from "@/src/lib/customers/debt-standing";
import type { CategoryBreakdown } from "@/src/lib/customers/category-breakdown";
import { formatVietnameseMoney } from "@/src/lib/format/money";

// DC-5a: khối "Theo nhóm" + panel "Đối chiếu tổng" trên trang khách.
// Presentational thuần (nhận CategoryBreakdown đã tính sẵn) — test renderToStaticMarkup.
// Tách khỏi page.tsx vì Next 15 cấm named value-export trên page. Mọi phép cộng đã
// nằm trong pure-fn buildCategoryBreakdown; component CHỈ render.

function formatMoneyValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
}

// Tạm tính: >=0 → số ở inkDeep; <0 → "Cọc dư |x|" tone paid (mẫu credit).
function TentativeCell({ tentative }: Readonly<{ tentative: number }>) {
  if (tentative < 0) {
    return (
      <span className="font-mono font-semibold text-paid">
        Cọc dư {formatMoneyValue(-tentative)}
      </span>
    );
  }

  return (
    <span className="font-mono font-semibold text-inkDeep">
      {formatMoneyValue(tentative)}
    </span>
  );
}

export function CategoryBreakdownPanel({
  breakdown,
}: Readonly<{ breakdown: CategoryBreakdown }>) {
  const finalLine = reconciliationFinalLine(breakdown.debtTotal);

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-6 text-textMute">
        Tạm tính theo nhóm chỉ để tham khảo — cọc chung áp cho cả công nợ.
      </p>

      {/* Bảng "Theo nhóm" — desktop */}
      <div className="hidden overflow-hidden rounded border border-ledgerBorder bg-surface sm:block">
        <table className="w-full table-fixed border-collapse text-left text-[16px] leading-7">
          <thead className="bg-paperWarm font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
            <tr>
              <th scope="col" className="px-3 py-2">
                Nhóm hàng
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Đã mua
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                Đã cọc
              </th>
              <th scope="col" className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1.5">
                  Tạm tính còn nợ
                  <span
                    className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-stamp/15 text-[9px] font-bold text-stamp"
                    title="Đã mua − Đã cọc của riêng nhóm. Số tham khảo, chưa trừ cọc chung."
                  >
                    ?
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ledgerBorder">
            {breakdown.groups.map((group) => (
              <tr key={group.name}>
                <td className="px-3 py-3 font-semibold text-inkDeep">
                  {group.name}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-textMain">
                  {formatMoneyValue(group.purchased)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-paid">
                  {formatMoneyValue(group.deposited)}
                </td>
                <td className="px-3 py-3 text-right">
                  <TentativeCell tentative={group.tentative} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danh sách thẻ "Theo nhóm" — mobile */}
      <div className="space-y-3 sm:hidden">
        {breakdown.groups.map((group) => (
          <div
            key={group.name}
            className="rounded border border-ledgerBorder bg-surface px-3 py-3 text-[16px] leading-7 shadow-[var(--shadow-card)]"
          >
            <p className="mb-2 border-b border-ledgerBorder pb-2 font-semibold text-inkDeep">
              {group.name}
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-[92px_minmax(0,1fr)] items-baseline gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                  Đã mua
                </p>
                <p className="text-right font-semibold text-textMain">
                  {formatMoneyValue(group.purchased)}
                </p>
              </div>
              <div className="grid grid-cols-[92px_minmax(0,1fr)] items-baseline gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                  Đã cọc
                </p>
                <p className="text-right font-semibold text-paid">
                  {formatMoneyValue(group.deposited)}
                </p>
              </div>
              <div className="grid grid-cols-[92px_minmax(0,1fr)] items-baseline gap-2">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                  Tạm tính còn nợ
                </p>
                <p className="text-right">
                  <TentativeCell tentative={group.tentative} />
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Panel "Đối chiếu tổng" — khuôn SettlementSummaryPanel (#31) */}
      <div className="rounded border border-ledgerBorder bg-paperWarm px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
          <p className="font-display text-[18px] font-semibold text-inkDeep">
            Σ Tạm tính các nhóm
          </p>
          <p className="break-words text-right font-mono text-[20px] font-bold leading-tight text-inkDeep">
            {formatMoneyValue(breakdown.groupTentativeTotal)}
          </p>
        </div>
        <div className="mt-2 space-y-2">
          {breakdown.generalDeposit > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
              <p className="font-display text-[17px] font-semibold text-paid">
                − Cọc chung
              </p>
              <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">
                {formatMoneyValue(breakdown.generalDeposit)}
              </p>
            </div>
          ) : null}
          {breakdown.paidImmediate > 0 ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
              <p className="font-display text-[17px] font-semibold text-paid">
                − Trả ngay khi mua
              </p>
              <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">
                {formatMoneyValue(breakdown.paidImmediate)}
              </p>
            </div>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-t border-dashed border-ledgerBorder pt-3">
          <p
            className={`font-display text-[19px] font-semibold ${
              finalLine.tone === "credit" ? "text-paid" : "text-debt"
            }`}
          >
            = {finalLine.label}
          </p>
          <p
            className={`break-words text-right font-mono text-[22px] font-bold leading-tight ${
              finalLine.tone === "credit" ? "text-paid" : "text-debt"
            }`}
          >
            {formatMoneyValue(finalLine.amount)}
          </p>
        </div>
      </div>
    </div>
  );
}
