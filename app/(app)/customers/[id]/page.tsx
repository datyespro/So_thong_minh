import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Phone } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  flattenCustomerPurchaseHistory,
  sumCustomerPurchaseHistoryTotal,
  type CustomerHistoryItem,
  type CustomerHistoryOrder,
  type CustomerPurchaseHistoryRow,
  type CustomerPurchaseHistorySortDirection,
} from "@/src/lib/customers/purchase-history";
import {
  buildCustomerDebtSummary,
  type CustomerDebtSummary,
} from "@/src/lib/customers/debt-summary";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { createClient } from "@/src/lib/supabase/server";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ sort?: string | string[] }>;
};

type CustomerDetailRow = {
  id: string;
  name: string;
  debt_total: number | string | null;
  phone: string | null;
};

type CustomerOrderRow = CustomerHistoryOrder & {
  total_amount: number | string | null;
  paid_amount: number | string | null;
};

type CustomerPaymentRow = {
  id: string;
  amount: number | string | null;
  paid_at: string | null;
};

const HISTORY_COLUMNS = [
  "Ngày",
  "Mặt hàng",
  "Số lượng",
  "Đơn vị",
  "Đơn giá",
  "Thành tiền",
] as const;

function normalizeSortDirection(
  value: string | string[] | undefined,
): CustomerPurchaseHistorySortDirection {
  return value === "date_desc" ? "date_desc" : "date_asc";
}

function formatMoneyValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
}

function formatBusinessDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

function formatPaymentDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = dayjs(value);

  return parsed.isValid()
    ? parsed.tz(APP_TIME_ZONE).format("DD/MM/YYYY HH:mm")
    : "—";
}

function formatPaymentDay(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = dayjs(value);

  return parsed.isValid()
    ? parsed.tz(APP_TIME_ZONE).format("DD/MM/YYYY")
    : "—";
}

function formatQuantity(value: number | string) {
  return String(value);
}

function shouldShowDebtFooter(
  total: number,
  summary: CustomerDebtSummary,
) {
  return (
    summary.reconciles &&
    summary.paidTotal > 0 &&
    total === summary.totalPurchase
  );
}

function paymentSortTime(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed.valueOf() : Number.POSITIVE_INFINITY;
}

function sortedPaymentsByPaidAt(payments: CustomerPaymentRow[]) {
  return [...payments].sort((left, right) => {
    const timeDiff =
      paymentSortTime(left.paid_at) - paymentSortTime(right.paid_at);

    return timeDiff === 0 ? left.id.localeCompare(right.id) : timeDiff;
  });
}

function normalizedPhoneHref(phone: string) {
  const trimmed = phone.trim();

  return trimmed.length > 0 ? `tel:${trimmed.replace(/\s+/g, "")}` : null;
}

function PurchaseHistoryEmptyState() {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-4 py-10 text-center">
      <p className="font-display text-xl font-semibold text-inkDeep">
        Khách này chưa có lịch sử mua.
      </p>
    </div>
  );
}

function PaymentHistoryEmptyState() {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-4 py-8 text-center">
      <p className="font-display text-xl font-semibold text-inkDeep">
        Khách này chưa có lần trả nợ nào.
      </p>
    </div>
  );
}

function DebtReconciliationLine({
  summary,
}: Readonly<{ summary: CustomerDebtSummary }>) {
  if (!summary.reconciles) {
    return (
      <div className="mt-4 border-t border-dashed border-ledgerBorder pt-3">
        <p className="text-[16px] font-semibold leading-7 text-debt">
          Số liệu đang lệch, cần kiểm tra ạ
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-dashed border-ledgerBorder pt-3">
      <p className="text-[16px] font-semibold leading-7 text-textMain">
        <span className="text-inkDeep">
          Tổng mua {formatMoneyValue(summary.totalPurchase)}
        </span>
        <span className="px-1 text-textMute">−</span>
        <span className="text-paid">
          Đã trả {formatMoneyValue(summary.paidTotal)}
        </span>
        <span className="px-1 text-textMute">=</span>
        <span className="text-debt">
          Còn nợ {formatMoneyValue(summary.debtTotal)}
        </span>
      </p>
      {summary.paidImmediate > 0 ? (
        <p className="mt-1 text-[15px] leading-6 text-textMute">
          Trả ngay khi mua:{" "}
          <span className="font-semibold text-paid">
            {formatMoneyValue(summary.paidImmediate)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function PaymentHistoryList({
  payments,
  total,
}: Readonly<{
  payments: CustomerPaymentRow[];
  total: number;
}>) {
  if (payments.length === 0) {
    return <PaymentHistoryEmptyState />;
  }

  return (
    <div className="overflow-hidden rounded border border-ledgerBorder bg-surface shadow-[var(--shadow-card)]">
      <ul className="divide-y divide-ledgerBorder">
        {payments.map((payment) => (
          <li
            key={payment.id}
            className="grid gap-2 px-4 py-3 text-[16px] leading-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
                Ngày trả
              </p>
              <p className="mt-1 font-semibold text-inkDeep">
                {formatPaymentDate(payment.paid_at)}
              </p>
            </div>
            <p className="font-display text-xl font-semibold tracking-normal text-paid sm:text-right">
              {formatMoneyValue(payment.amount)}
            </p>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 border-t-2 border-ledgerBorder bg-paperWarm px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <p className="font-display text-[18px] font-semibold text-inkDeep">
          Tổng đã trả nợ
        </p>
        <p className="font-mono text-[20px] font-bold text-paid sm:text-right">
          {formatMoneyValue(total)}
        </p>
      </div>
    </div>
  );
}

function MobileHistoryCard({ row }: Readonly<{ row: CustomerPurchaseHistoryRow }>) {
  const fields = [
    ["Ngày", formatBusinessDate(row.business_date)],
    ["Mặt hàng", row.product_name_snapshot],
    ["Số lượng", formatQuantity(row.quantity)],
    ["Đơn vị", row.unit_snapshot || "—"],
    ["Đơn giá", formatMoneyValue(row.unit_price)],
    ["Thành tiền", formatMoneyValue(row.line_total)],
  ] as const;

  return (
    <div className="rounded border border-ledgerBorder bg-surface px-3 py-3 text-[16px] leading-7 shadow-[var(--shadow-card)]">
      <div className="mb-2 border-b border-ledgerBorder pb-2">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
          {formatBusinessDate(row.business_date)}
        </p>
        <p className="mt-1 font-semibold text-inkDeep">
          {row.product_name_snapshot}
        </p>
      </div>
      <div className="space-y-2">
        {fields.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2"
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
              {label}
            </p>
            <p
              className={
                label === "Thành tiền"
                  ? "font-semibold text-inkDeep"
                  : "font-semibold text-textMain"
              }
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettlementSummaryPanel({
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
  const panelClassName = [
    "rounded border border-ledgerBorder bg-paperWarm px-4 py-3",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
        <p className="font-display text-[18px] font-semibold text-inkDeep">
          Tổng mua
        </p>
        <p className="break-words text-right font-mono text-[20px] font-bold leading-tight text-inkDeep">
          {formatMoneyValue(total)}
        </p>
      </div>

      <div className="mt-2 space-y-2">
        {orderedPayments.map((payment) => (
          <div
            key={payment.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4"
          >
            <p className="font-display text-[17px] font-semibold text-paid">
              − Trả {formatPaymentDay(payment.paid_at)}
            </p>
            <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">
              {formatMoneyValue(payment.amount)}
            </p>
          </div>
        ))}
        {summary.paidImmediate > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <p className="font-display text-[17px] font-semibold text-paid">
              − Trả ngay khi mua
            </p>
            <p className="break-words text-right font-mono text-[18px] font-bold leading-tight text-paid">
              {formatMoneyValue(summary.paidImmediate)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 border-t border-dashed border-ledgerBorder pt-3">
        <p className="font-display text-[19px] font-semibold text-debt">
          = Còn nợ
        </p>
        <p className="break-words text-right font-mono text-[22px] font-bold leading-tight text-debt">
          {formatMoneyValue(summary.debtTotal)}
        </p>
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
  const showDebtFooter = shouldShowDebtFooter(total, summary);

  if (showDebtFooter) {
    return (
      <SettlementSummaryPanel
        total={total}
        summary={summary}
        payments={payments}
        className="shadow-[var(--shadow-card)]"
      />
    );
  }

  return (
    <div className="rounded border border-ledgerBorder bg-paperWarm px-3 py-4 shadow-[var(--shadow-card)]">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
        Tổng cộng
      </p>
      <p className="mt-1 break-words text-right font-mono text-[22px] font-bold leading-tight text-inkDeep">
        {formatMoneyValue(total)}
      </p>
    </div>
  );
}

function PurchaseHistoryTable({
  rows,
  total,
  summary,
  payments,
  customerId,
  sort,
  nextSort,
}: Readonly<{
  rows: CustomerPurchaseHistoryRow[];
  total: number;
  summary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
  customerId: string;
  sort: CustomerPurchaseHistorySortDirection;
  nextSort: CustomerPurchaseHistorySortDirection;
}>) {
  if (rows.length === 0) {
    return <PurchaseHistoryEmptyState />;
  }

  const showDebtFooter = shouldShowDebtFooter(total, summary);

  return (
    <>
      <div className="hidden overflow-hidden rounded border border-ledgerBorder bg-surface sm:block">
        <table className="w-full table-fixed border-collapse text-left text-[16px] leading-7">
          <thead className="bg-paperWarm font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
            <tr>
              {HISTORY_COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-3 py-2 first:w-[112px] last:text-right"
                >
                  {column === "Ngày" ? (
                    <Link
                      href={`/customers/${customerId}?sort=${nextSort}`}
                      className="inline-flex items-center gap-1 hover:underline"
                      aria-label={
                        sort === "date_asc"
                          ? "Sắp xếp ngày mới nhất trước"
                          : "Sắp xếp ngày cũ nhất trước"
                      }
                    >
                      Ngày
                      <span aria-hidden="true">
                        {sort === "date_asc" ? "↑" : "↓"}
                      </span>
                    </Link>
                  ) : (
                    column
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ledgerBorder">
            {rows.map((row, index) => (
              <tr key={`${row.order_id}-${row.sort_order ?? "null"}-${index}`}>
                <td className="px-3 py-3 font-semibold text-textMute">
                  {formatBusinessDate(row.business_date)}
                </td>
                <td className="px-3 py-3 font-semibold text-inkDeep">
                  {row.product_name_snapshot}
                </td>
                <td className="px-3 py-3 font-semibold">
                  {formatQuantity(row.quantity)}
                </td>
                <td className="px-3 py-3 font-semibold text-textMute">
                  {row.unit_snapshot || "—"}
                </td>
                <td className="px-3 py-3 font-semibold">
                  {formatMoneyValue(row.unit_price)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-inkDeep">
                  {formatMoneyValue(row.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-ledgerBorder bg-paperWarm">
            {showDebtFooter ? (
              <tr>
                <td colSpan={6} className="px-3 py-3">
                  <SettlementSummaryPanel
                    total={total}
                    summary={summary}
                    payments={payments}
                    className="ml-auto w-full max-w-md"
                  />
                </td>
              </tr>
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-right font-display text-[18px] font-semibold text-inkDeep"
                >
                  Tổng cộng
                </td>
                <td className="px-3 py-3 text-right font-mono text-[18px] font-bold text-inkDeep">
                  {formatMoneyValue(total)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((row, index) => (
          <MobileHistoryCard
            key={`${row.order_id}-${row.sort_order ?? "null"}-${index}`}
            row={row}
          />
        ))}
        <MobileHistoryTotal
          total={total}
          summary={summary}
          payments={payments}
        />
      </div>
    </>
  );
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id: customerId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sort = normalizeSortDirection(resolvedSearchParams.sort);
  const nextSort: CustomerPurchaseHistorySortDirection =
    sort === "date_asc" ? "date_desc" : "date_asc";

  if (!customerId) {
    notFound();
  }

  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data: customerData, error: customerError } = await supabase
    .from("customers")
    .select("id,name,debt_total,phone")
    .eq("owner_id", user.id)
    .eq("id", customerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerError || !customerData) {
    notFound();
  }

  const customer = customerData as CustomerDetailRow;
  const { data: orderData, error: ordersError } = await supabase
    .from("orders")
    .select("id,business_date,total_amount,paid_amount")
    .eq("owner_id", user.id)
    .eq("customer_id", customerId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .order("business_date", { ascending: false });

  if (ordersError) {
    throw new Error("Không tải được lịch sử đơn của khách.");
  }

  const orders = (orderData ?? []) as CustomerOrderRow[];
  const { data: paymentData, error: paymentsError } = await supabase
    .from("payments")
    .select("id,amount,paid_at")
    .eq("owner_id", user.id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("paid_at", { ascending: false });

  if (paymentsError) {
    throw new Error("Không tải được lịch sử trả nợ của khách.");
  }

  const payments = (paymentData ?? []) as CustomerPaymentRow[];
  const orderIds = orders.map((order) => order.id);
  let items: CustomerHistoryItem[] = [];

  if (orderIds.length > 0) {
    const { data: itemData, error: itemsError } = await supabase
      .from("order_items")
      .select(
        "order_id,product_name_snapshot,quantity,unit_snapshot,unit_price,line_total,sort_order",
      )
      .eq("owner_id", user.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      throw new Error("Không tải được lịch sử mua của khách.");
    }

    items = (itemData ?? []) as CustomerHistoryItem[];
  }

  const historyRows = flattenCustomerPurchaseHistory(orders, items, sort);
  const historyTotal = sumCustomerPurchaseHistoryTotal(historyRows);
  const debtSummary = buildCustomerDebtSummary({
    orders,
    payments,
    debtTotal: customer.debt_total,
  });
  const phoneHref = customer.phone ? normalizedPhoneHref(customer.phone) : null;

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 border-b border-ledgerBorder pb-4">
          <Link
            href="/customers"
            className="inline-flex h-10 items-center gap-2 rounded border border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-normal text-inkDeep">
            {customer.name}
          </h1>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="rounded border border-ledgerBorder bg-surface px-4 py-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
              Số nợ hiện tại
            </p>
            <p className="mt-2 font-mono text-[34px] font-bold leading-none text-debt sm:text-[40px]">
              {formatMoneyValue(customer.debt_total)}
            </p>
            <DebtReconciliationLine summary={debtSummary} />
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled
              title="Sẽ làm sau"
              className="h-11 rounded border-ledgerBorder bg-surface px-4 text-[16px] font-semibold text-textMute"
            >
              <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
              Ghi trả
            </Button>
            {phoneHref ? (
              <Button
                asChild
                className="h-11 rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep"
              >
                <a href={phoneHref}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Gọi
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <section className="mb-6" aria-labelledby="payment-history-heading">
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-ledgerBorder pb-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Tiền khách trả
              </p>
              <h2
                id="payment-history-heading"
                className="mt-1 font-display text-2xl font-semibold text-inkDeep"
              >
                Lịch sử trả nợ
              </h2>
            </div>
            {payments.length > 0 ? (
              <p className="font-mono text-[12px] font-semibold text-textMute">
                {payments.length} lần
              </p>
            ) : null}
          </div>

          <PaymentHistoryList
            payments={payments}
            total={debtSummary.paidLater}
          />
        </section>

        <section aria-labelledby="purchase-history-heading">
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-ledgerBorder pb-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Giao dịch bán
              </p>
              <h2
                id="purchase-history-heading"
                className="mt-1 font-display text-2xl font-semibold text-inkDeep"
              >
                Lịch sử mua
              </h2>
            </div>
            {historyRows.length > 0 ? (
              <div className="text-right">
                <Link
                  href={`/customers/${customer.id}?sort=${nextSort}`}
                  className="font-mono text-[12px] font-semibold text-stamp underline-offset-4 hover:underline sm:hidden"
                  aria-label={
                    sort === "date_asc"
                      ? "Sắp xếp ngày mới nhất trước"
                      : "Sắp xếp ngày cũ nhất trước"
                  }
                >
                  Sắp xếp: {sort === "date_asc" ? "Cũ → mới" : "Mới → cũ"}
                </Link>
                <p className="hidden font-mono text-[12px] font-semibold text-textMute sm:block">
                  {historyRows.length} dòng
                </p>
              </div>
            ) : null}
          </div>

          <PurchaseHistoryTable
            rows={historyRows}
            total={historyTotal}
            summary={debtSummary}
            payments={payments}
            customerId={customer.id}
            sort={sort}
            nextSort={nextSort}
          />
        </section>
      </div>
    </section>
  );
}
