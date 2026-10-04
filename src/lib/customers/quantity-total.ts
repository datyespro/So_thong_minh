import type { CustomerPurchaseHistoryRow } from "./purchase-history";
import { formatUnitDisplay } from "../format/unit";

export type CustomerQuantityTotal = {
  quantityDisplay: string;
  unitDisplay: string;
};

const SCALE = BigInt(100);
const ZERO = BigInt(0);
// A single quantity follows NUMERIC(14,2); a sum may exceed that row range.
const MAX_ROW_CENTS = BigInt("99999999999999");
// Explicit display contract: reject totals beyond the safe integer cents range.
const MAX_TOTAL_CENTS = BigInt(Number.MAX_SAFE_INTEGER);

function parseQuantityCents(quantity: number | string): bigint | null {
  if (typeof quantity !== "number" && typeof quantity !== "string") return null;
  if (typeof quantity === "number" && (!Number.isFinite(quantity) || quantity <= 0)) {
    return null;
  }

  const decimal = String(quantity);
  // Reject unsupported range before constructing BigInt from external data.
  if (decimal.length > 15 || !/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(decimal)) return null;

  const [whole, fraction = ""] = decimal.split(".");
  const cents = BigInt(whole) * SCALE + BigInt(fraction.padEnd(2, "0"));
  return cents > ZERO && cents <= MAX_ROW_CENTS ? cents : null;
}

function canonicalUnit(unit: string | null): string | null {
  if (typeof unit !== "string") return null;
  const display = formatUnitDisplay(unit).trim().replace(/\s+/g, " ").toLowerCase();
  return display.length > 0 && display !== "—" ? display : null;
}

export function sumCustomerPurchaseHistoryQuantity(
  rows: readonly Pick<CustomerPurchaseHistoryRow, "product_id" | "unit_snapshot" | "quantity">[],
): CustomerQuantityTotal | null {
  if (rows.length === 0) return null;

  const productId = rows[0].product_id;
  const unitDisplay = canonicalUnit(rows[0].unit_snapshot);
  if (typeof productId !== "string" || productId.trim().length === 0 || unitDisplay === null) {
    return null;
  }

  let totalCents = ZERO;
  for (const row of rows) {
    if (row.product_id !== productId || canonicalUnit(row.unit_snapshot) !== unitDisplay) {
      return null;
    }
    const cents = parseQuantityCents(row.quantity);
    if (cents === null) return null;
    totalCents += cents;
    if (totalCents > MAX_TOTAL_CENTS) return null;
  }

  const whole = (totalCents / SCALE).toString();
  const fraction = (totalCents % SCALE).toString().padStart(2, "0").replace(/0+$/, "");
  return {
    quantityDisplay: fraction.length > 0 ? `${whole},${fraction}` : whole,
    unitDisplay,
  };
}
