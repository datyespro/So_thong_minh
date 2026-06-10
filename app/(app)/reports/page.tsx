import Link from "next/link";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { APP_TIME_ZONE, businessDateVN, dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import {
  nextDate,
  normalizeReportDate,
  prevDate,
  reportDateUtcRange,
} from "@/src/lib/reports/daily";
import { createClient } from "@/src/lib/supabase/server";

type NumericValue = number | string | null;

type EmbeddedCustomer =
  | { name: string }
  | Array<{ name: string }>
  | null;

type DailyOrder = {
  id: string;
  total_amount: NumericValue;
  paid_amount: NumericValue;
  debt_amount: NumericValue;
  created_at: string;
  customer: EmbeddedCustomer;
};

type DailyOrderItem = {
  order_id: string;
  product_name_snapshot: string;
  quantity: number | string;
  unit_snapshot: string | null;
  unit_price: NumericValue;
  line_total: NumericValue;
  sort_order: number;
};

type DailyPayment = {
  id: string;
  amount: NumericValue;
  paid_at: string;
  customer: EmbeddedCustomer;
};

type ReportsPageProps = {
  searchParams?: Promise<{ date?: string | string[] }>;
};

function numericValue(value: NumericValue) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: NumericValue) {
  return formatVietnameseMoney(numericValue(value));
}

function embeddedCustomerName(
  customer: EmbeddedCustomer,
  fallback: string,
) {
  const row = Array.isArray(customer) ? customer[0] : customer;
  const name = row?.name.trim();

  return name && name.length > 0 ? name : fallback;
}

function formatReportDate(date: string) {
  return dayjs.tz(date, APP_TIME_ZONE).format("DD/MM/YYYY");
}

function formatTransactionTime(timestamp: string) {
  return dayjs(timestamp).tz(APP_TIME_ZONE).format("HH:mm");
}

function sumStoredMoney<T>(rows: T[], select: (row: T) => NumericValue) {
  return rows.reduce((total, row) => total + numericValue(select(row)), 0);
}

function ReportEmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded border border-dashed border-borderStrong bg-paperWarm px-5 py-9 text-center">
      <p className="font-display text-lg italic text-textMute">{children}</p>
    </div>
  );
}

function SummaryHeadline({
  salesTotal,
  collectedTotal,
}: Readonly<{
  salesTotal: number;
  collectedTotal: number;
}>) {
  return (
    <div className="grid overflow-hidden rounded border border-ledgerBorder bg-surface shadow-[var(--shadow-card)] sm:grid-cols-2">
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[15px] font-semibold text-textMute">Tổng bán</p>
        <p className="mt-2 font-display text-3xl font-semibold tracking-normal text-inkDeep sm:text-4xl">
          {formatMoney(salesTotal)}
        </p>
      </div>
      <div className="border-t border-ledgerBorder px-5 py-5 sm:border-l sm:border-t-0 sm:px-6 sm:py-6">
        <p className="text-[15px] font-semibold text-textMute">Tổng thu</p>
        <p className="mt-2 font-display text-3xl font-semibold tracking-normal text-paid sm:text-4xl">
          {formatMoney(collectedTotal)}
        </p>
      </div>
    </div>
  );
}

function BlockTotal({
  label,
  total,
  tone = "sales",
}: Readonly<{
  label: string;
  total: number;
  tone?: "sales" | "collected";
}>) {
  return (
    <div
      className={`mt-4 flex items-baseline justify-end gap-4 border-t-2 pt-4 ${
        tone === "collected" ? "border-paid" : "border-inkDeep"
      }`}
    >
      <span className="text-[15px] font-semibold text-textMute">{label}</span>
      <span
        className={`font-display text-2xl font-bold tracking-normal ${
          tone === "collected" ? "text-paid" : "text-inkDeep"
        }`}
      >
        {formatMoney(total)}
      </span>
    </div>
  );
}

function OrderItemLines({ items }: Readonly<{ items: DailyOrderItem[] }>) {
  if (items.length === 0) {
    return (
      <p className="mt-4 border-t border-dashed border-ledgerBorder pt-4 text-[15px] italic text-textMute">
        Đơn này chưa có dòng món.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-3 border-t border-dashed border-ledgerBorder pt-4">
      {items.map((item, index) => (
        <li
          key={`${item.order_id}-${item.sort_order}-${index}`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] leading-6 text-textMain"
        >
          <span className="font-semibold text-inkDeep">
            {item.product_name_snapshot}
          </span>
          <span className="text-textMute" aria-hidden="true">
            ·
          </span>
          <span className="text-textMute">
            {String(item.quantity)} {item.unit_snapshot || "—"} × {formatMoney(item.unit_price)}
          </span>
          <span className="min-w-6 flex-1 border-b border-dotted border-borderStrong" aria-hidden="true" />
          <span className="font-mono text-[14px] font-semibold text-inkDeep">
            {formatMoney(item.line_total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DailyOrders({
  orders,
  itemsByOrder,
}: Readonly<{
  orders: DailyOrder[];
  itemsByOrder: Map<string, DailyOrderItem[]>;
}>) {
  if (orders.length === 0) {
    return <ReportEmptyState>Chưa có đơn ngày này.</ReportEmptyState>;
  }

  const total = sumStoredMoney(orders, (order) => order.total_amount);

  return (
    <>
      <div className="space-y-4">
        {orders.map((order, index) => (
          <article
            key={order.id}
            className="rounded border border-ledgerBorder bg-surface px-4 py-5 shadow-[var(--shadow-card)] sm:px-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-borderStrong font-mono text-[12px] font-semibold text-textMute">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="break-words font-display text-xl font-semibold tracking-normal text-inkDeep">
                    {embeddedCustomerName(order.customer, "Khách lẻ")}
                  </h3>
                  <p className="mt-1 font-mono text-[12px] text-textFaint">
                    {formatTransactionTime(order.created_at)}
                  </p>
                </div>
              </div>
              <div className="border-t border-dashed border-ledgerBorder pt-3 sm:border-t-0 sm:pt-0 sm:text-right">
                <p className="font-display text-xl font-semibold tracking-normal text-debt">
                  Còn nợ {formatMoney(order.debt_amount)}
                </p>
                <p className="mt-1 font-mono text-[12px] leading-5 text-textMute">
                  Tổng {formatMoney(order.total_amount)} · Đã trả {formatMoney(order.paid_amount)}
                </p>
              </div>
            </div>
            <OrderItemLines items={itemsByOrder.get(order.id) ?? []} />
          </article>
        ))}
      </div>
      <BlockTotal label="Tổng bán" total={total} />
    </>
  );
}

function DailyPayments({ payments }: Readonly<{ payments: DailyPayment[] }>) {
  if (payments.length === 0) {
    return <ReportEmptyState>Chưa có khoản thu ngày này.</ReportEmptyState>;
  }

  const total = sumStoredMoney(payments, (payment) => payment.amount);

  return (
    <>
      <div className="divide-y divide-ledgerBorder border-y border-ledgerBorder">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-4 px-1 py-4"
          >
            <div className="min-w-0">
              <p className="break-words font-display text-lg font-semibold tracking-normal text-inkDeep">
                {embeddedCustomerName(payment.customer, "Khách hàng")}
              </p>
              <p className="mt-1 font-mono text-[12px] text-textFaint">
                {formatTransactionTime(payment.paid_at)}
              </p>
            </div>
            <p className="shrink-0 font-display text-xl font-semibold tracking-normal text-paid">
              {formatMoney(payment.amount)}
            </p>
          </div>
        ))}
      </div>
      <BlockTotal label="Tổng thu" total={total} tone="collected" />
    </>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? undefined
    : resolvedSearchParams.date;
  const reportDate = normalizeReportDate(requestedDate);
  const today = businessDateVN();
  const { startUtc, endUtc } = reportDateUtcRange(reportDate);
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const [ordersResult, paymentsResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,total_amount,paid_amount,debt_amount,created_at,customer:customers(name)",
      )
      .eq("owner_id", user.id)
      .eq("business_date", reportDate)
      .eq("status", "confirmed")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("id,amount,paid_at,customer:customers(name)")
      .eq("owner_id", user.id)
      .gte("paid_at", startUtc)
      .lt("paid_at", endUtc)
      .is("deleted_at", null)
      .order("paid_at", { ascending: true }),
  ]);

  if (ordersResult.error) {
    throw new Error("Không tải được đơn bán trong ngày.");
  }

  if (paymentsResult.error) {
    throw new Error("Không tải được khoản thu trong ngày.");
  }

  const orders = (ordersResult.data ?? []) as DailyOrder[];
  const payments = (paymentsResult.data ?? []) as DailyPayment[];
  const orderIds = orders.map((order) => order.id);
  let items: DailyOrderItem[] = [];

  if (orderIds.length > 0) {
    const { data, error } = await supabase
      .from("order_items")
      .select(
        "order_id,product_name_snapshot,quantity,unit_snapshot,unit_price,line_total,sort_order",
      )
      .eq("owner_id", user.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error("Không tải được các dòng món trong ngày.");
    }

    items = (data ?? []) as DailyOrderItem[];
  }

  const itemsByOrder = new Map<string, DailyOrderItem[]>();

  for (const item of items) {
    const orderItems = itemsByOrder.get(item.order_id) ?? [];
    orderItems.push(item);
    itemsByOrder.set(item.order_id, orderItems);
  }

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl pb-10">
        <header className="mb-7 border-b border-ledgerBorder pb-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            Báo cáo
          </p>
          <div className="mt-2 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-semibold tracking-normal text-inkDeep">
                Xem đơn hằng ngày
              </h1>
              <p className="mt-2 font-display text-xl font-semibold text-textMute">
                {reportDate === today ? "Hôm nay" : "Ngày"} · {formatReportDate(reportDate)}
              </p>
            </div>
            <nav
              className="grid w-full grid-cols-3 gap-2 sm:w-auto"
              aria-label="Chọn ngày báo cáo"
            >
              <Link
                href={`/reports?date=${prevDate(reportDate)}`}
                className="inline-flex min-h-10 items-center justify-center rounded border border-borderStrong bg-surface px-3 text-[14px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
              >
                ‹ Hôm trước
              </Link>
              <Link
                href={`/reports?date=${today}`}
                className="inline-flex min-h-10 items-center justify-center rounded bg-ink px-3 text-[14px] font-semibold text-paper hover:bg-inkDeep"
              >
                Hôm nay
              </Link>
              <Link
                href={`/reports?date=${nextDate(reportDate)}`}
                className="inline-flex min-h-10 items-center justify-center rounded border border-borderStrong bg-surface px-3 text-[14px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
              >
                Hôm sau ›
              </Link>
            </nav>
          </div>
        </header>

        <SummaryHeadline
          salesTotal={sumStoredMoney(orders, (order) => order.total_amount)}
          collectedTotal={sumStoredMoney(payments, (payment) => payment.amount)}
        />

        <section className="mt-10" aria-labelledby="daily-orders-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2
              id="daily-orders-heading"
              className="font-display text-2xl font-semibold tracking-normal text-inkDeep"
            >
              Đơn bán trong ngày
            </h2>
            <span className="font-mono text-[12px] text-textFaint">
              {orders.length} đơn
            </span>
            <span className="h-px flex-1 bg-ledgerBorder" aria-hidden="true" />
          </div>
          <DailyOrders orders={orders} itemsByOrder={itemsByOrder} />
        </section>

        <section className="mt-10" aria-labelledby="daily-payments-heading">
          <div className="mb-4 flex items-center gap-3">
            <h2
              id="daily-payments-heading"
              className="font-display text-2xl font-semibold tracking-normal text-inkDeep"
            >
              Thu nợ trong ngày
            </h2>
            <span className="font-mono text-[12px] text-textFaint">
              {payments.length} khoản
            </span>
            <span className="h-px flex-1 bg-ledgerBorder" aria-hidden="true" />
          </div>
          <DailyPayments payments={payments} />
        </section>
      </div>
    </section>
  );
}
