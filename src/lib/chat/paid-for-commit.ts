import type { ResolvedIntent } from "@/src/lib/ai/resolve-schema";

type PaymentStatus = NonNullable<ResolvedIntent["payment_status"]>;

export function paidForCommit(
  paymentStatus: PaymentStatus | null | undefined,
  paidAmountRaw: number | null | undefined,
  orderTotal: number | null | undefined,
): number {
  if (orderTotal == null || orderTotal <= 0) {
    return 0;
  }

  if (paymentStatus === "paid") {
    return orderTotal;
  }

  if (
    paymentStatus === "partial" &&
    paidAmountRaw != null &&
    paidAmountRaw > 0
  ) {
    return Math.min(paidAmountRaw, orderTotal);
  }

  return 0;
}
