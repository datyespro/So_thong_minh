"use client";

import Link from "next/link";
import { Printer, X } from "lucide-react";
import { InvoiceActionPopover } from "@/src/components/invoice/printable-customer-section";
import type { CustomerPurchaseHistoryRow, CustomerPurchaseHistorySortDirection } from "@/src/lib/customers/purchase-history";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";
import { UNCLASSIFIED_LABEL } from "@/src/lib/customers/category-breakdown";
import { reconciliationFinalLine } from "@/src/lib/customers/debt-standing";
import { groupRowsByOrder, type GroupedOrder } from "@/src/lib/customers/group-orders";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { formatUnitDisplay } from "@/src/lib/format/unit";
import { isProductInSelectedGroups, resolveProductChipToggle } from "@/src/lib/customers/filter-history";
import { paymentScopeSuffix } from "@/src/lib/customers/payment-scope-label";
import { useHistoryFilter } from "./history-filter-provider";
import { Button } from "@/src/components/ui/button";

export type CustomerPaymentRow = {
  id: string;
  amount: number | string | null;
  paid_at: string | null;
  scope_label?: string | null;
};

const HISTORY_COLUMNS = [
  "Ngày",
  "Mặt hàng",
  "Số lượng",
  "Đơn vị",
  "Đơn giá",
  "Thành tiền",
] as const;

const MULTI_ORDER_BORDER_STYLE = {
  borderLeft: "3px solid var(--color-border-info, var(--ink-soft))",
} as const;

function formatMoneyValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
}

// DC-5b: nhãn nhóm mờ dưới tên mặt hàng. Ẩn khi chưa gắn nhóm để tránh nhiễu.
function CategoryTag({ name }: Readonly<{ name: string | null | undefined }>) {
  if (!name || name === UNCLASSIFIED_LABEL) {
    return null;
  }

  return (
    <span className="mt-0.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-stamp">
      {name}
    </span>
  );
}

function formatBusinessDate(value: string | null) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

function formatPaymentDay(value: string | null) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.tz(APP_TIME_ZONE).format("DD/MM/YYYY") : "—";
}

function formatQuantity(value: number | string) {
  return String(value);
}

function shouldShowDebtFooter(total: number, summary: CustomerDebtSummary) {
  return summary.reconciles && summary.paidTotal > 0 && total === summary.totalPurchase;
}

function paymentSortTime(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.valueOf() : Number.POSITIVE_INFINITY;
}

function sortedPaymentsByPaidAt(payments: CustomerPaymentRow[]) {
  return [...payments].sort((left, right) => {
    const timeDiff = paymentSortTime(left.paid_at) - paymentSortTime(right.paid_at);
    return timeDiff === 0 ? left.id.localeCompare(right.id) : timeDiff;
  });
}

function PurchaseHistoryEmptyState() {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-4 py-10 text-center">
      <p className="font-display text-xl font-semibold text-inkDeep">
        Không có dòng nào khớp bộ lọc.
      </p>
    </div>
  );
}

export function SettlementSummaryPanel({
  total,
  summary,
  payments,
  className = "",
}: Readonly<{
  total: number;
  summary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
  className?: string;
}>) {
  const orderedPayments = sortedPaymentsByPaidAt(payments);
  const finalLine = reconciliationFinalLine(summary.debtTotal);
  const panelClassName = ["rounded border border-ledgerBorder bg-paperWarm px-4 py-3", className].filter(Boolean).join(" ");

  return (
    <div className={panelClassName}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
        <p className="font-display text-[18px] font-semibold text-inkDeep">Tổng mua</p>
        <p className="break-words text-right font-mono text-[20px] font-bold leading-tight text-inkDeep">{formatMoneyValue(total)}</p>
      </div>
      <div className="mt-2 space-y-2">
        {orderedPayments.map((payment) => (
          <div key={payment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <p className="font-display text-[17px] font-semibold text-paid">− Trả {formatPaymentDay(payment.paid_at)}{paymentScopeSuffix(payment.scope_label)}</p>
            <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">{formatMoneyValue(payment.amount)}</p>
          </div>
        ))}
        {summary.paidImmediate > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <p className="font-display text-[17px] font-semibold text-paid">− Trả ngay khi mua</p>
            <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">{formatMoneyValue(summary.paidImmediate)}</p>
          </div>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-t border-dashed border-ledgerBorder pt-3">
        <p className={`font-display text-[19px] font-semibold ${finalLine.tone === "credit" ? "text-paid" : "text-debt"}`}>= {finalLine.label}</p>
        <p className={`break-words text-right font-mono text-[22px] font-bold leading-tight ${finalLine.tone === "credit" ? "text-paid" : "text-debt"}`}>{formatMoneyValue(finalLine.amount)}</p>
      </div>
    </div>
  );
}

function MobileHistoryTotal({
  total,
  summary,
  payments,
}: Readonly<{
  total: number;
  summary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
}>) {
  if (shouldShowDebtFooter(total, summary)) {
    return <SettlementSummaryPanel total={total} summary={summary} payments={payments} className="shadow-[var(--shadow-card)]" />;
  }

  return (
    <div className="rounded border border-ledgerBorder bg-paperWarm px-3 py-4 shadow-[var(--shadow-card)]">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">Tổng cộng</p>
      <p className="mt-1 break-words text-right font-mono text-[22px] font-bold leading-tight text-inkDeep">{formatMoneyValue(total)}</p>
    </div>
  );
}

function MobileHistoryCard({
  row,
  isNewGroup,
  deletable,
  orderSummary,
}: Readonly<{
  row: CustomerPurchaseHistoryRow;
  isNewGroup?: boolean;
  deletable?: boolean;
  orderSummary?: { businessDate: string | null; total: number; itemCount: number; firstItemName: string | null; };
}>) {
  const fields = [
    ["Ngày", formatBusinessDate(row.business_date)],
    ["Mặt hàng", row.product_name_snapshot],
    ["Số lượng", formatQuantity(row.quantity)],
    ["Đơn vị", formatUnitDisplay(row.unit_snapshot) || "—"],
    ["Đơn giá", formatMoneyValue(row.unit_price)],
    ["Thành tiền", formatMoneyValue(row.line_total)],
  ] as const;

  const className = [
    "rounded border border-ledgerBorder bg-surface px-3 py-3 text-[16px] leading-7 shadow-[var(--shadow-card)]",
    isNewGroup && "mt-3",
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-ledgerBorder pb-2">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">{formatBusinessDate(row.business_date)}</p>
          <p className="mt-1 font-semibold text-inkDeep">{row.product_name_snapshot}</p>
          <CategoryTag name={row.category_name} />
        </div>
        <div className="shrink-0">
          <InvoiceActionPopover orderId={row.order_id} itemCount={1} deletable={deletable} orderSummary={orderSummary} />
        </div>
      </div>
      <div className="space-y-2">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">{label}</p>
            <p className={label === "Thành tiền" ? "font-semibold text-inkDeep" : "font-semibold text-textMain"}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileGroupedHistoryCard({
  order,
  isNewGroup,
  deletable,
}: Readonly<{
  order: GroupedOrder;
  isNewGroup?: boolean;
  deletable?: boolean;
}>) {
  const firstRow = order.items[0];
  if (!firstRow) return null;

  const className = [
    "rounded border border-ledgerBorder bg-surface px-3 py-3 text-[16px] leading-7 shadow-[var(--shadow-card)]",
    isNewGroup && "mt-3",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} style={MULTI_ORDER_BORDER_STYLE}>
      <div className="mb-2 flex items-start justify-between gap-3 border-b border-ledgerBorder pb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
              {formatBusinessDate(order.business_date ?? firstRow.business_date)}
            </p>
            <span className="rounded border border-ledgerBorder bg-paperWarm px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-stamp">
              {order.items.length} món
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <InvoiceActionPopover 
            orderId={order.order_id} 
            itemCount={order.items.length} 
            deletable={deletable}
            orderSummary={{
              businessDate: order.business_date,
              total: order.total,
              itemCount: order.items.length,
              firstItemName: order.items[0]?.product_name_snapshot ?? null,
            }} 
          />
        </div>
      </div>
      <ul className="space-y-2">
        {order.items.map((item, index) => (
          <li key={`${item.order_id}-${item.sort_order ?? "null"}-${index}`} className="rounded border border-ledgerBorder bg-paperWarm px-3 py-2">
            <p className="break-words font-semibold text-inkDeep">{item.product_name_snapshot}</p>
            <CategoryTag name={item.category_name} />
            <p className="mt-1 break-words font-semibold text-textMute">
              {formatQuantity(item.quantity)} {formatUnitDisplay(item.unit_snapshot) || "đơn vị"} × {formatMoneyValue(item.unit_price)} ={" "}
              <span className="font-mono font-bold text-inkDeep">{formatMoneyValue(item.line_total)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PurchaseHistoryTable({
  summary,
  payments,
  customerId,
  sort,
  nextSort,
}: Readonly<{
  summary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
  customerId: string;
  sort: CustomerPurchaseHistorySortDirection;
  nextSort: CustomerPurchaseHistorySortDirection;
}>) {
  const { filter, setFilter, filteredRows: rows, filteredTotal: total, isFiltered, productNameOptions, categoryNameOptions, productCategoryIndex } = useHistoryFilter();

  // DC-5c: bấm SP ngoài nhóm đang chọn → tự bỏ nhóm về Chung rồi lọc theo SP đó.
  const toggleProductName = (name: string) => {
    setFilter(resolveProductChipToggle(filter, name, productCategoryIndex));
  };

  const toggleCategoryName = (name: string) => {
    const current = filter.categoryNames ?? [];
    const next = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    setFilter({ ...filter, categoryNames: next.length > 0 ? next : null });
  };

  const handleClearFilter = () => {
    setFilter({ ...filter, fromDate: null, toDate: null, productNames: null, categoryNames: null });
  };

  const showDebtFooter = shouldShowDebtFooter(total, summary);
  const orderRowCounts = new Map<string, number>();

  rows.forEach((row) => {
    orderRowCounts.set(row.order_id, (orderRowCounts.get(row.order_id) ?? 0) + 1);
  });

  const groupedDisplayRows = groupRowsByOrder(rows);
  const orderById = new Map(groupedDisplayRows.map((o) => [o.order_id, o]));

  return (
    <div className="space-y-4">
      {/* Thanh lọc */}
      <div className="flex flex-wrap items-center gap-3 rounded border border-ledgerBorder bg-surface px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full">
          <div className="flex items-center gap-2">
            <label htmlFor="fromDate" className="text-sm font-semibold text-inkDeep">Từ ngày:</label>
            <input
              type="date"
              id="fromDate"
              value={filter.fromDate ?? ""}
              onChange={(e) => setFilter({ ...filter, fromDate: e.target.value || null })}
              className="h-9 rounded border border-ledgerBorder bg-paper px-2 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="toDate" className="text-sm font-semibold text-inkDeep">Đến ngày:</label>
            <input
              type="date"
              id="toDate"
              value={filter.toDate ?? ""}
              onChange={(e) => setFilter({ ...filter, toDate: e.target.value || null })}
              className="h-9 rounded border border-ledgerBorder bg-paper px-2 text-sm text-ink outline-none focus:border-brand"
            />
          </div>
          {isFiltered && (
            <Button variant="ghost" size="sm" onClick={handleClearFilter} className="h-9 text-textMute hover:text-ink">
              <X className="mr-1 h-4 w-4" />
              Xóa lọc
            </Button>
          )}
        </div>
        
        {categoryNameOptions.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
              Nhóm:
            </span>
            {categoryNameOptions.map((name) => {
              const isSelected = filter.categoryNames?.includes(name) ?? false;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleCategoryName(name)}
                  className={`rounded border px-3 py-1 text-sm ${
                    isSelected
                      ? "border-stamp bg-paperWarm font-semibold text-inkDeep ring-1 ring-stamp"
                      : "border-ledgerBorder bg-surface text-textMain hover:bg-paperWarm hover:text-ink"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {productNameOptions.length > 0 && (
          <div className="flex w-full flex-wrap gap-2 pt-1">
            {productNameOptions.map((name) => {
              const isSelected = filter.productNames?.includes(name) ?? false;
              const groupActive = (filter.categoryNames?.length ?? 0) > 0;
              const inGroup = isProductInSelectedGroups(productCategoryIndex, name, filter.categoryNames);
              // ưu tiên: selected > mờ > thường. Chip mờ vẫn bấm được (không disabled).
              const dimmed = groupActive && !inGroup && !isSelected;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleProductName(name)}
                  title={dimmed ? "Bấm để lọc theo mặt hàng này (sẽ bỏ lọc nhóm)" : undefined}
                  className={`rounded border px-3 py-1 text-sm ${
                    isSelected
                      ? "border-stamp bg-paperWarm font-semibold text-inkDeep ring-1 ring-stamp"
                      : dimmed
                        ? "border-ledgerBorder bg-surface text-textMute opacity-45 hover:opacity-100 hover:bg-paperWarm hover:text-ink"
                        : "border-ledgerBorder bg-surface text-textMain hover:bg-paperWarm hover:text-ink"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <PurchaseHistoryEmptyState />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded border border-ledgerBorder bg-surface sm:block">
            <table className="w-full table-fixed border-collapse text-left text-[16px] leading-7">
              <thead className="bg-paperWarm font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
                <tr>
                  {HISTORY_COLUMNS.map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 first:w-[112px] last:text-right">
                      {column === "Ngày" ? (
                        <Link
                          href={`/customers/${customerId}?sort=${nextSort}`}
                          className="inline-flex items-center gap-1 hover:underline"
                          aria-label={sort === "date_asc" ? "Sắp xếp ngày mới nhất trước" : "Sắp xếp ngày cũ nhất trước"}
                        >
                          Ngày
                          <span aria-hidden="true">{sort === "date_asc" ? "↑" : "↓"}</span>
                        </Link>
                      ) : (
                        column
                      )}
                    </th>
                  ))}
                  <th scope="col" className="w-[44px] px-1 py-2 text-right">
                    <Printer className="ml-auto h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">In</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ledgerBorder">
                {rows.map((row, index) => {
                  const itemCount = orderRowCounts.get(row.order_id) ?? 1;
                  const isMultiItemOrder = itemCount > 1;
                  const isFirstOrderRow = index === 0 || rows[index - 1]?.order_id !== row.order_id;
                  const isLastOrderRow = index === rows.length - 1 || rows[index + 1]?.order_id !== row.order_id;
                  const shouldShowInvoiceAction = !isMultiItemOrder || isLastOrderRow;
                  const isNewGroup = isFirstOrderRow && index > 0;
                  
                  const tdClass = isNewGroup ? "px-3 pb-3 pt-5 border-t-2 border-ledgerBorder" : "px-3 py-3";
                  const lastTdClass = isNewGroup ? "px-1 pb-3 pt-5 border-t-2 border-ledgerBorder text-right" : "px-1 py-3 text-right";

                  return (
                    <tr
                      key={`${row.order_id}-${row.sort_order ?? "null"}-${index}`}
                      className={isMultiItemOrder && isFirstOrderRow && !isNewGroup ? "border-t-2 border-t-ledgerBorder" : undefined}
                    >
                      <td className={`${tdClass} font-semibold text-textMute`} style={isMultiItemOrder ? MULTI_ORDER_BORDER_STYLE : undefined}>
                        {formatBusinessDate(row.business_date)}
                      </td>
                      <td className={`${tdClass} font-semibold text-inkDeep`}>
                        <span className="block">{row.product_name_snapshot}</span>
                        <CategoryTag name={row.category_name} />
                      </td>
                      <td className={`${tdClass} font-semibold`}>{formatQuantity(row.quantity)}</td>
                      <td className={`${tdClass} font-semibold text-textMute`}>{formatUnitDisplay(row.unit_snapshot) || "—"}</td>
                      <td className={`${tdClass} font-semibold`}>{formatMoneyValue(row.unit_price)}</td>
                      <td className={`${tdClass} text-right font-semibold text-inkDeep`}>{formatMoneyValue(row.line_total)}</td>
                      <td className={lastTdClass}>
                        {shouldShowInvoiceAction ? (() => {
                          const orderData = orderById.get(row.order_id);
                          const orderSummary = orderData ? {
                            businessDate: orderData.business_date,
                            total: orderData.total,
                            itemCount: orderData.items.length,
                            firstItemName: orderData.items[0]?.product_name_snapshot ?? null,
                          } : undefined;
                          return <InvoiceActionPopover orderId={row.order_id} itemCount={itemCount} deletable={true} orderSummary={orderSummary} />;
                        })() : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-ledgerBorder bg-paperWarm">
                {showDebtFooter ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-3">
                      <SettlementSummaryPanel total={total} summary={summary} payments={payments} className="ml-auto w-full max-w-md" />
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right font-display text-[18px] font-semibold text-inkDeep">Tổng cộng</td>
                    <td className="px-3 py-3 text-right font-mono text-[18px] font-bold text-inkDeep">{formatMoneyValue(total)}</td>
                    <td className="px-3 py-3"></td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          <div className="space-y-3 sm:hidden">
            {groupedDisplayRows.map((order, index) => {
              const firstRow = order.items[0];
              if (!firstRow) return null;
              const isNewGroup = index > 0;
              return order.items.length > 1 ? (
                <MobileGroupedHistoryCard key={order.order_id} order={order} isNewGroup={isNewGroup} deletable={true} />
              ) : (
                <MobileHistoryCard 
                  key={order.order_id} 
                  row={firstRow} 
                  isNewGroup={isNewGroup} 
                  deletable={true} 
                  orderSummary={{
                    businessDate: order.business_date,
                    total: order.total,
                    itemCount: order.items.length,
                    firstItemName: firstRow.product_name_snapshot ?? null,
                  }}
                />
              );
            })}
            <MobileHistoryTotal total={total} summary={summary} payments={payments} />
          </div>
        </>
      )}
    </div>
  );
}
