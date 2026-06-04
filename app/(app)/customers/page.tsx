import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { createClient } from "@/src/lib/supabase/server";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { cn } from "@/src/lib/utils";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  debt_total: number | string | null;
};

const CUSTOMER_COLUMNS = ["Tên khách", "Số nợ", "Điện thoại", "Xem"] as const;

function customerDetailHref(customerId: string) {
  return `/customers/${customerId}`;
}

function coerceMoneyValue(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoneyValue(value: number | string | null | undefined) {
  return formatVietnameseMoney(coerceMoneyValue(value));
}

function formatPhone(value: string | null) {
  const phone = value?.trim();

  return phone && phone.length > 0 ? phone : "—";
}

function CustomersEmptyState() {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-4 py-10 text-center">
      <p className="font-display text-xl font-semibold text-inkDeep">
        Chưa có khách hàng nào.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[16px] leading-7 text-textMute">
        Khi bác ghi đơn bán hoặc tạo khách mới, khách sẽ xuất hiện ở đây.
      </p>
    </div>
  );
}

function DebtValue({ value }: Readonly<{ value: number | string | null }>) {
  const numeric = coerceMoneyValue(value);

  return (
    <span
      className={cn(
        "font-mono font-semibold",
        numeric > 0 ? "text-debt" : "text-textMain",
      )}
    >
      {formatMoneyValue(value)}
    </span>
  );
}

function CustomersTable({ customers }: Readonly<{ customers: CustomerRow[] }>) {
  return (
    <div className="hidden overflow-hidden rounded border border-ledgerBorder bg-surface sm:block">
      <table className="w-full table-fixed border-collapse text-left text-[16px] leading-7">
        <thead className="bg-paperWarm font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp">
          <tr>
            {CUSTOMER_COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 py-2 first:w-[38%] last:w-[96px] last:text-right"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ledgerBorder">
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="px-3 py-3">
                <Link
                  href={customerDetailHref(customer.id)}
                  className="font-semibold text-inkDeep underline-offset-4 hover:underline"
                >
                  {customer.name}
                </Link>
              </td>
              <td className="px-3 py-3">
                <DebtValue value={customer.debt_total} />
              </td>
              <td className="px-3 py-3 font-semibold text-textMute">
                {formatPhone(customer.phone)}
              </td>
              <td className="px-3 py-3 text-right">
                <Link
                  href={customerDetailHref(customer.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded border border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
                  aria-label={`Xem chi tiết ${customer.name}`}
                >
                  Xem
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerMobileCard({ customer }: Readonly<{ customer: CustomerRow }>) {
  return (
    <div className="rounded border border-ledgerBorder bg-surface px-3 py-3 text-[16px] leading-7 shadow-[var(--shadow-card)]">
      <Link
        href={customerDetailHref(customer.id)}
        className="block font-display text-xl font-semibold text-inkDeep underline-offset-4 hover:underline"
      >
        {customer.name}
      </Link>

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
            Số nợ
          </p>
          <DebtValue value={customer.debt_total} />
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
            Điện thoại
          </p>
          <p className="break-words font-semibold text-textMute">
            {formatPhone(customer.phone)}
          </p>
        </div>
      </div>

      <Link
        href={customerDetailHref(customer.id)}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-ink px-3 text-[15px] font-semibold text-paper hover:bg-inkDeep"
      >
        Xem chi tiết
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function CustomersMobileList({
  customers,
}: Readonly<{ customers: CustomerRow[] }>) {
  return (
    <div className="space-y-3 sm:hidden">
      {customers.map((customer) => (
        <CustomerMobileCard key={customer.id} customer={customer} />
      ))}
    </div>
  );
}

export default async function CustomersPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,debt_total")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Không tải được danh sách khách hàng.");
  }

  const customers = (data ?? []) as CustomerRow[];

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 border-b border-ledgerBorder pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                KHÁCH HÀNG
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal text-inkDeep">
                Danh sách khách hàng
              </h1>
              <p className="mt-2 text-[16px] leading-7 text-textMute">
                Bấm vào một khách để xem số nợ và lịch sử mua.
              </p>
            </div>
            {customers.length > 0 ? (
              <p className="font-mono text-[12px] font-semibold text-textMute">
                {customers.length} khách
              </p>
            ) : null}
          </div>
        </div>

        {customers.length === 0 ? (
          <CustomersEmptyState />
        ) : (
          <>
            <CustomersTable customers={customers} />
            <CustomersMobileList customers={customers} />
          </>
        )}
      </div>
    </section>
  );
}
