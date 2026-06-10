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

function sumStoredMoney<T>(rows: T[], select: (row: T) => NumericValue) {
  return rows.reduce((total, row) => total + numericValue(select(row)), 0);
}

function ReportEmptyState({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-4 py-9 text-center">
      <p className="font-display text-xl font-semibold text-inkDeep">{children}</p>
    </div>
  );
}

function BlockTotal({ label, total }: Readonly<{ label: string; total: number }>) {
  return (
    <div className="flex items-center justify-between gap-4 border-t-2 border-ledgerBorder bg-paperWarm px-4 py-3">
      <span className="font-display text-lg font-semibold text-inkDeep">{label}</span>
      <span className="font-mono text-lg font-bold text-inkDeep">
        {formatMoney(total)}
      </span>
    </div>
  );
}

function OrderItemRows({ items }: Readonly<{ items: DailyOrderItem[] }>) {
  if (items.length === 0) {
    return (
      <p className="border-t border-ledgerBorder px-4 py-4 text-[15px] text-textMute">
        Đơn này chưa có dòng món.
      </p>
    );
  }

  return (
    <div className="border-t border-ledgerBorder">
      <div className="hidden grid-cols-[minmax(0,1fr)_90px_100px_140px_140px] gap-3 bg-paperWarm px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-stamp sm:grid">
        <span>Mặt hàng</span>
        <span>Số lượng</span>
        <span>Đơn vị</span>
        <span className="text-right">Đơn giá</span>
        <span className="text-right">Thành tiền</span>
      </div>

      <div className="divide-y divide-ledgerBorder">
        {items.map((item, index) => (
          <div
            key={`${item.order_id}-${item.sort_order}-${index}`}
            className="grid gap-2 px-4 py-3 text-[15px] leading-6 sm:grid-cols-[minmax(0,1fr)_90px_100px_140px_140px] sm:gap-3"
          >
            <p className="font-semibold text-inkDeep">
              {item.product_name_snapshot}
            </p>
            <p>
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-stamp sm:hidden">
                SL
              </span>
              <span className="font-semibold">{String(item.quantity)}</span>
            </p>
            <p className="font-semibold text-textMute">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-stamp sm:hidden">
                Đơn vị
              </span>
              {item.unit_snapshot || "—"}
            </p>
            <p className="font-semibold sm:text-right">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-stamp sm:hidden">
                Đơn giá
              </span>
              {formatMoney(item.unit_price)}
            </p>
            <p className="font-mono font-semibold text-inkDeep sm:text-right">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-stamp sm:hidden">
                Thành tiền
              </span>
              {formatMoney(item.line_total)}
            </p>
          </div>
        ))}
      </div>
    </div>
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
      <div className="space-y-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="overflow-hidden rounded border border-ledgerBorder bg-surface shadow-[var(--shadow-card)]"
          >
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(112px,auto))] sm:items-end">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stamp">
                  Khách hàng
                </p>
                <h3 className="mt-1 font-display text-xl font-semibold text-inkDeep">
                  {embeddedCustomerName(order.customer, "Khách lẻ")}
                </h3>
              </div>
              {[
                ["Tổng tiền", order.total_amount],
                ["Đã trả", order.paid_amount],
                ["Còn nợ", order.debt_amount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-baseline justify-between gap-3 sm:block sm:text-right"
                >
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-stamp">
                    {label}
                  </p>
                  <p
                    className={
                      label === "Còn nợ"
                        ? "font-mono font-bold text-debt"
                        : "font-mono font-bold text-inkDeep"
                    }
                  >
                    {formatMoney(value)}
                  </p>
                </div>
              ))}
            </div>
            <OrderItemRows items={itemsByOrder.get(order.id) ?? []} />
          </article>
        ))}
      </div>
      <div className="mt-3">
        <BlockTotal label="Tổng bán" total={total} />
      </div>
    </>
  );
}

function DailyPayments({ payments }: Readonly<{ payments: DailyPayment[] }>) {
  if (payments.length === 0) {
    return <ReportEmptyState>Chưa có khoản thu ngày này.</ReportEmptyState>;
  }

  const total = sumStoredMoney(payments, (payment) => payment.amount);

  return (
    <div className="overflow-hidden rounded border border-ledgerBorder bg-surface shadow-[var(--shadow-card)]">
      <div className="divide-y divide-ledgerBorder">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-4 px-4 py-4"
          >
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-stamp">
                Khách hàng
              </p>
              <p className="mt-1 break-words font-display text-lg font-semibold text-inkDeep">
                {embeddedCustomerName(payment.customer, "Khách hàng")}
              </p>
            </div>
            <p className="shrink-0 font-mono text-lg font-bold text-paid">
              {formatMoney(payment.amount)}
            </p>
          </div>
        ))}
      </div>
      <BlockTotal label="Tổng thu" total={total} />
    </div>
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
      <div className="mx-auto max-w-6xl pb-8">
        <header className="mb-6 border-b border-ledgerBorder pb-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            Báo cáo
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-normal text-inkDeep">
                Xem đơn hằng ngày
              </h1>
              <p className="mt-2 text-[16px] font-semibold text-textMute">
                {reportDate === today ? "Hôm nay" : "Ngày"} · {formatReportDate(reportDate)}
              </p>
            </div>
            <nav
              className="grid w-full grid-cols-3 gap-2 sm:w-auto"
              aria-label="Chọn ngày báo cáo"
            >
              <Link
                href={`/reports?date=${prevDate(reportDate)}`}
                className="inline-flex h-10 items-center justify-center rounded border border-ledgerBorder bg-surface px-3 text-[14px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
              >
                ‹ Hôm trước
              </Link>
              <Link
                href={`/reports?date=${today}`}
                className="inline-flex h-10 items-center justify-center rounded bg-ink px-3 text-[14px] font-semibold text-paper hover:bg-inkDeep"
              >
                Hôm nay
              </Link>
              <Link
                href={`/reports?date=${nextDate(reportDate)}`}
                className="inline-flex h-10 items-center justify-center rounded border border-ledgerBorder bg-surface px-3 text-[14px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
              >
                Hôm sau ›
              </Link>
            </nav>
          </div>
        </header>

        <section aria-labelledby="daily-orders-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Khối A
              </p>
              <h2
                id="daily-orders-heading"
                className="mt-1 font-display text-2xl font-semibold text-inkDeep"
              >
                Đơn bán trong ngày
              </h2>
            </div>
            {orders.length > 0 ? (
              <p className="font-mono text-[12px] font-semibold text-textMute">
                {orders.length} đơn
              </p>
            ) : null}
          </div>
          <DailyOrders orders={orders} itemsByOrder={itemsByOrder} />
        </section>

        <section className="mt-8" aria-labelledby="daily-payments-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Khối B
              </p>
              <h2
                id="daily-payments-heading"
                className="mt-1 font-display text-2xl font-semibold text-inkDeep"
              >
                Thu nợ trong ngày
              </h2>
            </div>
            {payments.length > 0 ? (
              <p className="font-mono text-[12px] font-semibold text-textMute">
                {payments.length} khoản
              </p>
            ) : null}
          </div>
          <DailyPayments payments={payments} />
        </section>
      </div>
    </section>
  );
}
