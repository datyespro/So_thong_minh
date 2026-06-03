import { formatVietnameseMoney } from "@/src/lib/format/money";

export type ProductNumericValue = number | string | null | undefined;

export function coerceProductNumber(value: ProductNumericValue) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

export function formatProductSellPrice(value: ProductNumericValue) {
  const numeric = coerceProductNumber(value);

  return numeric === null ? "—" : formatVietnameseMoney(numeric);
}

export function formatProductStock(value: ProductNumericValue) {
  const numeric = coerceProductNumber(value) ?? 0;

  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function isNegativeProductStock(value: ProductNumericValue) {
  return (coerceProductNumber(value) ?? 0) < 0;
}
