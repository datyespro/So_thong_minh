import type { CustomerPurchaseHistoryRow } from "./purchase-history";

export type HistoryFilter = {
  fromDate: string | null;
  toDate: string | null;
  productNames: string[] | null;
};

export function filterHistoryRows(
  rows: CustomerPurchaseHistoryRow[],
  filter: HistoryFilter,
): { rows: CustomerPurchaseHistoryRow[]; total: number } {
  const { fromDate, toDate, productNames } = filter;
  
  if (fromDate && toDate && fromDate > toDate) {
    return { rows: [], total: 0 };
  }

  const filtered = rows.filter((row) => {
    if ((fromDate || toDate) && !row.business_date) {
      return false;
    }

    if (fromDate && row.business_date && row.business_date < fromDate) {
      return false;
    }

    if (toDate && row.business_date && row.business_date > toDate) {
      return false;
    }

    if (productNames && productNames.length > 0) {
      if (!productNames.includes(row.product_name_snapshot)) {
        return false;
      }
    }

    return true;
  });

  const total = filtered.reduce((acc, row) => {
    const amount = Number(row.line_total ?? 0);
    return acc + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return { rows: filtered, total };
}

export function isHistoryFiltered(filter: HistoryFilter): boolean {
  return (
    filter.fromDate !== null ||
    filter.toDate !== null ||
    (filter.productNames !== null && filter.productNames.length > 0)
  );
}

export function distinctProductNames(rows: CustomerPurchaseHistoryRow[]): string[] {
  const seen = new Set<string>();
  const distinct: string[] = [];
  
  for (const row of rows) {
    if (!seen.has(row.product_name_snapshot)) {
      seen.add(row.product_name_snapshot);
      distinct.push(row.product_name_snapshot);
    }
  }
  
  return distinct;
}
