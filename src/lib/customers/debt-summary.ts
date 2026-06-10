type MoneyInput = number | string | null | undefined;

export type CustomerDebtSummaryOrder = {
  total_amount: MoneyInput;
  paid_amount: MoneyInput;
};

export type CustomerDebtSummaryPayment = {
  amount: MoneyInput;
};

export type CustomerDebtSummary = {
  totalPurchase: number;
  paidImmediate: number;
  paidLater: number;
  paidTotal: number;
  debtTotal: number;
  reconciles: boolean;
};

function numericMoney(value: MoneyInput): number {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

function sumMoney<T>(
  rows: T[],
  pickValue: (row: T) => MoneyInput,
): number {
  return rows.reduce((total, row) => total + numericMoney(pickValue(row)), 0);
}

export function buildCustomerDebtSummary({
  orders,
  payments,
  debtTotal,
}: Readonly<{
  orders: CustomerDebtSummaryOrder[];
  payments: CustomerDebtSummaryPayment[];
  debtTotal: MoneyInput;
}>): CustomerDebtSummary {
  const totalPurchase = sumMoney(orders, (order) => order.total_amount);
  const paidImmediate = sumMoney(orders, (order) => order.paid_amount);
  const paidLater = sumMoney(payments, (payment) => payment.amount);
  const paidTotal = paidImmediate + paidLater;
  const normalizedDebtTotal = numericMoney(debtTotal);

  return {
    totalPurchase,
    paidImmediate,
    paidLater,
    paidTotal,
    debtTotal: normalizedDebtTotal,
    reconciles: totalPurchase - paidTotal === normalizedDebtTotal,
  };
}
