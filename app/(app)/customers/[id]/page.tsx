import "@/src/styles/print.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDollarSign, Info, Phone } from "lucide-react";
import {
  PrintableCustomerSection,
  SummaryInvoicePopover,
} from "@/src/components/invoice/printable-customer-section";
import { HistoryFilterProvider } from "@/src/components/customers/history-filter-provider";
import { PurchaseHistoryTable } from "@/src/components/customers/purchase-history-table";
import { PaymentScopeEditButton } from "@/src/components/customers/payment-scope-edit-button";
import { Button } from "@/src/components/ui/button";
import {
  flattenCustomerPurchaseHistory,
  sumCustomerPurchaseHistoryTotal,
  type CustomerHistoryItem,
  type CustomerHistoryOrder,
  type CustomerPurchaseHistorySortDirection,
} from "@/src/lib/customers/purchase-history";
import {
  buildCustomerDebtSummary,
  type CustomerDebtSummary,
} from "@/src/lib/customers/debt-summary";
import { DebtHeadline } from "@/src/components/customers/debt-display";
import { CategoryBreakdownPanel } from "@/src/components/customers/category-breakdown-panel";
import {
  debtStanding,
  reconciliationFinalLine,
} from "@/src/lib/customers/debt-standing";
import {
  buildCategoryBreakdown,
  resolveItemGroupName,
} from "@/src/lib/customers/category-breakdown";
import { groupRowsByOrder } from "@/src/lib/customers/group-orders";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { getShopSettings } from "@/src/lib/shop/get-shop-settings";
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
  scope_category_id: string | null;
};

// DC-5a: dòng order_item kèm product_id để gom theo nhóm (KHÔNG mở rộng
// CustomerHistoryItem — type đó dùng cho bảng lịch sử).
type CategoryItemRow = {
  product_id: string | null;
  line_total: number | string | null;
};



function normalizeSortDirection(
  value: string | string[] | undefined,
): CustomerPurchaseHistorySortDirection {
  return value === "date_desc" ? "date_desc" : "date_asc";
}

function formatMoneyValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return formatVietnameseMoney(Number.isFinite(numeric) ? numeric : 0);
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

function normalizedPhoneHref(phone: string) {
  const trimmed = phone.trim();

  return trimmed.length > 0 ? `tel:${trimmed.replace(/\s+/g, "")}` : null;
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

  const finalLine = reconciliationFinalLine(summary.debtTotal);

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
        <span className={finalLine.tone === "credit" ? "text-paid" : "text-debt"}>
          {finalLine.label} {formatMoneyValue(finalLine.amount)}
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
  categoryName,
}: Readonly<{
  payments: CustomerPaymentRow[];
  total: number;
  categoryName: Map<string, string>;
}>) {
  if (payments.length === 0) {
    return <PaymentHistoryEmptyState />;
  }

  return (
    <div className="overflow-hidden rounded border border-ledgerBorder bg-surface shadow-[var(--shadow-card)]">
      <ul className="divide-y divide-ledgerBorder">
        {payments.map((payment) => {
          // DC-4c: nhãn nhóm cọc — null khi không scope HOẶC scope vào danh mục đã
          // xóa mềm (orphan, không có trong map) → hiện "Chung" (không render dòng "Nhóm").
          const scopeLabel = payment.scope_category_id
            ? (categoryName.get(payment.scope_category_id) ?? null)
            : null;

          return (
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
                {scopeLabel ? (
                  <p className="mt-1 text-[15px] leading-6 text-textMute">
                    Nhóm: <span className="font-semibold text-inkDeep">{scopeLabel}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <p className="font-display text-xl font-semibold tracking-normal text-paid sm:text-right">
                  {formatMoneyValue(payment.amount)}
                </p>
                <PaymentScopeEditButton
                  paymentId={payment.id}
                  currentScopeLabel={scopeLabel}
                />
              </div>
            </li>
          );
        })}
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
  const shopSettings = await getShopSettings(user.id);
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
    .select("id,amount,paid_at,scope_category_id")
    .eq("owner_id", user.id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("paid_at", { ascending: false });

  if (paymentsError) {
    throw new Error("Không tải được lịch sử trả nợ của khách.");
  }

  const payments = (paymentData ?? []) as CustomerPaymentRow[];
  const orderIds = orders.map((order) => order.id);
  type RawItemRow = CustomerHistoryItem & CategoryItemRow;
  let rawItemRows: RawItemRow[] = [];

  if (orderIds.length > 0) {
    const { data: itemData, error: itemsError } = await supabase
      .from("order_items")
      .select(
        "order_id,product_id,product_name_snapshot,quantity,unit_snapshot,unit_price,line_total,sort_order",
      )
      .eq("owner_id", user.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      throw new Error("Không tải được lịch sử mua của khách.");
    }

    rawItemRows = (itemData ?? []) as RawItemRow[];
  }

  const categoryItems: CategoryItemRow[] = rawItemRows.map((row) => ({
    product_id: row.product_id,
    line_total: row.line_total,
  }));

  // DC-5a: nhóm hàng cho cọc/mua (thuần ĐỌC). products lấy category_id (KHÔNG lọc
  // deleted_at — cần nhóm cả hàng đã xóa mềm); product_categories CHỈ danh mục còn
  // sống (xóa mềm → "Chưa phân loại"/"Cọc chung"). Fetch phụ lỗi → degrade map rỗng,
  // KHÔNG làm vỡ trang (pure-fn vẫn dựng, breakdown.reconciles quyết định hiển thị).
  const productCategory = new Map<string, string | null>();
  const distinctProductIds = Array.from(
    new Set(
      categoryItems
        .map((item) => item.product_id)
        .filter((id): id is string => id != null),
    ),
  );

  if (distinctProductIds.length > 0) {
    const { data: productData } = await supabase
      .from("products")
      .select("id,category_id")
      .eq("owner_id", user.id)
      .in("id", distinctProductIds);

    for (const row of (productData ?? []) as {
      id: string;
      category_id: string | null;
    }[]) {
      productCategory.set(row.id, row.category_id);
    }
  }

  const categoryName = new Map<string, string>();
  const { data: categoryData } = await supabase
    .from("product_categories")
    .select("id,name")
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  for (const row of (categoryData ?? []) as { id: string; name: string }[]) {
    categoryName.set(row.id, row.name);
  }

  // DC-5b: gắn nhãn nhóm cho từng dòng mua bằng ĐÚNG hàm DC-5a (nguồn nhãn duy nhất)
  // — Map đã dựng xong ở trên nên nhãn trùng khít khối "Đối chiếu theo nhóm".
  const items: CustomerHistoryItem[] = rawItemRows.map((row) => ({
    order_id: row.order_id,
    product_name_snapshot: row.product_name_snapshot,
    quantity: row.quantity,
    unit_snapshot: row.unit_snapshot,
    unit_price: row.unit_price,
    line_total: row.line_total,
    sort_order: row.sort_order,
    category_name: resolveItemGroupName(
      row.product_id,
      productCategory,
      categoryName,
    ),
  }));

  // DC-5d: gắn nhãn nhóm cho mỗi cọc bằng map categoryName (DC-5a, còn sống) — orphan/
  // null → scope_label null (hiện "Chung", không ngoặc). Truyền xuống panel màn + bản in.
  const paymentsWithScope = payments.map((payment) => ({
    ...payment,
    scope_label: payment.scope_category_id
      ? (categoryName.get(payment.scope_category_id) ?? null)
      : null,
  }));

  const historyRows = flattenCustomerPurchaseHistory(orders, items, sort);
  const groupedOrders = groupRowsByOrder(historyRows);
  const historyTotal = sumCustomerPurchaseHistoryTotal(historyRows);
  const debtSummary = buildCustomerDebtSummary({
    orders,
    payments,
    debtTotal: customer.debt_total,
  });
  const categoryBreakdown = buildCategoryBreakdown({
    items: categoryItems,
    payments,
    productCategory,
    categoryName,
    paidImmediate: debtSummary.paidImmediate,
    debtTotal: customer.debt_total,
  });
  const showCategoryBreakdown =
    categoryBreakdown.reconciles && categoryBreakdown.groups.length > 0;
  const phoneHref = customer.phone ? normalizedPhoneHref(customer.phone) : null;
  const debtNumeric = Number(customer.debt_total ?? 0);
  const isCreditStanding =
    debtStanding(Number.isFinite(debtNumeric) ? debtNumeric : 0).kind ===
    "credit";
  const pdfDate = dayjs().tz(APP_TIME_ZONE).format("DD-MM-YYYY");

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <HistoryFilterProvider rows={historyRows}>
        <PrintableCustomerSection
          shopSettings={shopSettings}
          customerName={customer.name}
          customerPhone={customer.phone}
          rows={historyRows}
          historyTotal={historyTotal}
          debtSummary={debtSummary}
          payments={paymentsWithScope}
          groupedOrders={groupedOrders}
        >
          <div className="customer-detail-screen mx-auto max-w-6xl">
        <div className="mb-5 border-b border-ledgerBorder pb-4">
          <Link
            href="/customers"
            className="inline-flex h-10 items-center gap-2 rounded border border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Quay lại
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-normal text-inkDeep">
                {customer.name}
              </h1>
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="mt-2 inline-flex items-center gap-1.5 text-[15px] text-textMute hover:text-ink"
                >
                  <Phone className="h-[15px] w-[15px]" aria-hidden="true" />
                  {customer.phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* TIER 1 · Thẻ nợ nổi bật — nền chuyển sắc + viền trái màu nợ/credit */}
        <div className="mb-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-stretch">
          <div
            className="rounded-[8px] border border-borderStrong p-5 shadow-[var(--shadow-card)] sm:p-6"
            style={{
              background: "linear-gradient(180deg, #fffdf4, #fdf6df)",
              borderLeftWidth: "5px",
              borderLeftColor: isCreditStanding ? "#15803d" : "#b91c1c",
            }}
          >
            <DebtHeadline debtTotal={customer.debt_total} />
            <DebtReconciliationLine summary={debtSummary} />
          </div>

          <div className="flex flex-col gap-2.5 md:min-w-[210px] [&_button]:w-full">
            {phoneHref ? (
              <Button
                asChild
                className="h-11 w-full rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep"
              >
                <a href={phoneHref}>
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Gọi khách
                </a>
              </Button>
            ) : null}
            <div className="[&>div]:w-full">
              <SummaryInvoicePopover
                pdfFilename={`cong-no-${customer.name}-${pdfDate}.pdf`}
                imageFilename={`cong-no-${customer.name}-${pdfDate}.png`}
              />
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                disabled
                className="h-11 w-full rounded border-ledgerBorder bg-surface px-4 text-[16px] font-semibold text-textMute"
              >
                <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
                Ghi trả
              </Button>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] leading-snug text-textFaint">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Tính năng ghi trả đang phát triển
              </p>
            </div>
          </div>
        </div>

        {showCategoryBreakdown ? (
          <section className="mb-6" aria-labelledby="category-breakdown-heading">
            <div className="mb-3 border-b border-ledgerBorder pb-3">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Cọc theo nhóm hàng
              </p>
              <h2
                id="category-breakdown-heading"
                className="mt-1 font-display text-2xl font-semibold text-inkDeep"
              >
                Đối chiếu theo nhóm
              </h2>
            </div>
            <CategoryBreakdownPanel breakdown={categoryBreakdown} />
          </section>
        ) : null}

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
            categoryName={categoryName}
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
            summary={debtSummary}
            payments={paymentsWithScope}
            customerId={customer.id}
            sort={sort}
            nextSort={nextSort}
          />
        </section>
        </div>
        </PrintableCustomerSection>
      </HistoryFilterProvider>
    </section>
  );
}
