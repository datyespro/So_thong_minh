import { UNCLASSIFIED_LABEL } from "./category-breakdown";
import type { CustomerPurchaseHistoryRow } from "./purchase-history";

export type HistoryFilter = {
  fromDate: string | null;
  toDate: string | null;
  productNames: string[] | null;
  categoryNames: string[] | null;
};

export function filterHistoryRows(
  rows: CustomerPurchaseHistoryRow[],
  filter: HistoryFilter,
): { rows: CustomerPurchaseHistoryRow[]; total: number } {
  const { fromDate, toDate, productNames, categoryNames } = filter;

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

    if (categoryNames && categoryNames.length > 0) {
      // coalesce null → "Chưa phân loại" để chip "Chưa phân loại" lọc đúng.
      if (!categoryNames.includes(row.category_name ?? UNCLASSIFIED_LABEL)) {
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
    (filter.productNames !== null && filter.productNames.length > 0) ||
    (filter.categoryNames !== null && filter.categoryNames.length > 0)
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

// DC-5b: tên nhóm duy nhất (coalesce null → "Chưa phân loại"), sort A→Z (vi) nhưng
// "Chưa phân loại" luôn ĐỨNG CUỐI — giống sort nhóm ở DC-5a (buildCategoryBreakdown).
export function distinctCategoryNames(
  rows: CustomerPurchaseHistoryRow[],
): string[] {
  const seen = new Set<string>();
  const distinct: string[] = [];

  for (const row of rows) {
    const name = row.category_name ?? UNCLASSIFIED_LABEL;

    if (!seen.has(name)) {
      seen.add(name);
      distinct.push(name);
    }
  }

  return distinct.sort((left, right) => {
    if (left === UNCLASSIFIED_LABEL) {
      return right === UNCLASSIFIED_LABEL ? 0 : 1;
    }

    if (right === UNCLASSIFIED_LABEL) {
      return -1;
    }

    return left.localeCompare(right, "vi");
  });
}
