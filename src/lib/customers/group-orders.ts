import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";

export type GroupedOrder = {
  order_id: string;
  business_date: string | null;
  items: CustomerPurchaseHistoryRow[];
  total: number;
};

export function groupRowsByOrder(
  rows: CustomerPurchaseHistoryRow[],
): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>();

  for (const row of rows) {
    let group = map.get(row.order_id);

    if (!group) {
      group = {
        order_id: row.order_id,
        business_date: row.business_date,
        items: [],
        total: 0,
      };
      map.set(row.order_id, group);
    }

    group.items.push(row);

    const lineTotal = Number(row.line_total ?? 0);
    group.total += Number.isFinite(lineTotal) ? lineTotal : 0;
  }

  return Array.from(map.values());
}
