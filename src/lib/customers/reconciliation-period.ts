import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";

export function earliestTransactionDate(
  orders: { business_date: string | null }[],
  payments: { paid_at: string | null }[],
): string | null {
  const dates = [
    ...orders.map((order) => order.business_date),
    ...payments.map((payment) => paymentBusinessDate(payment.paid_at)),
  ].filter((date): date is string => date !== null && date.trim() !== "");

  if (dates.length === 0) {
    return null;
  }

  dates.sort();
  return dates[0];
}

type MoneyInput = number | string | null | undefined;

export type PeriodLedgerOrder = {
  business_date: string | null;
  total_amount: MoneyInput;
  paid_amount: MoneyInput;
};

export type PeriodLedgerPayment = {
  amount: MoneyInput;
  paid_at: string | null;
};

function numericMoney(value: MoneyInput): number {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

/** Ngày trả (YYYY-MM-DD) theo giờ cửa hàng; paid_at lưu UTC. */
export function paymentBusinessDate(paidAt: string | null): string | null {
  if (!paidAt) {
    return null;
  }

  const parsed = dayjs(paidAt);

  return parsed.isValid() ? parsed.tz(APP_TIME_ZONE).format("YYYY-MM-DD") : null;
}

/**
 * Sổ công nợ theo kỳ [fromDate, toDate] (đầu nào null thì bỏ đầu đó).
 * Nợ cũ = mọi giao dịch trước fromDate; giao dịch sau toDate bị bỏ.
 */
export function buildPeriodLedger<P extends PeriodLedgerPayment>({
  orders,
  payments,
  fromDate,
  toDate,
}: Readonly<{
  orders: PeriodLedgerOrder[];
  payments: P[];
  fromDate: string | null;
  toDate: string | null;
}>) {
  // Ngày null khi đang có kỳ → xếp vào nợ cũ để tổng cuối không bao giờ mất tiền.
  const isBefore = (date: string | null) =>
    (fromDate !== null || toDate !== null) && (date === null || (fromDate !== null && date < fromDate));
  const isAfter = (date: string | null) => toDate !== null && date !== null && date > toDate;

  let openingDebt = 0;
  let periodPurchase = 0;
  let periodPaidImmediate = 0;
  const periodPayments: P[] = [];

  for (const order of orders) {
    const total = numericMoney(order.total_amount);
    const paid = numericMoney(order.paid_amount);

    if (isBefore(order.business_date)) {
      openingDebt += total - paid;
    } else if (!isAfter(order.business_date)) {
      periodPurchase += total;
      periodPaidImmediate += paid;
    }
  }

  for (const payment of payments) {
    const date = paymentBusinessDate(payment.paid_at);

    if (isBefore(date)) {
      openingDebt -= numericMoney(payment.amount);
    } else if (!isAfter(date)) {
      periodPayments.push(payment);
    }
  }

  const periodPaid = periodPayments.reduce(
    (total, payment) => total + numericMoney(payment.amount),
    0,
  );

  return {
    openingDebt,
    periodPurchase,
    periodPaidImmediate,
    periodPayments,
    closingDebt: openingDebt + periodPurchase - periodPaidImmediate - periodPaid,
  };
}
