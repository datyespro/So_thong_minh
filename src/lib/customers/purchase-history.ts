export type CustomerHistoryOrder = {
  id: string;
  business_date: string | null;
};

export type CustomerHistoryItem = {
  order_id: string;
  product_name_snapshot: string;
  quantity: number | string;
  unit_snapshot: string | null;
  unit_price: number | string;
  line_total: number | string | null | undefined;
  sort_order: number | null;
};

export type CustomerPurchaseHistoryRow = {
  order_id: string;
  business_date: string | null;
  product_name_snapshot: string;
  quantity: number | string;
  unit_snapshot: string | null;
  unit_price: number | string;
  line_total: number | string | null | undefined;
  sort_order: number | null;
};

export type CustomerPurchaseHistorySortDirection = "date_asc" | "date_desc";

type OrderMeta = {
  business_date: string | null;
  index: number;
};

function compareBusinessDate(
  left: string | null,
  right: string | null,
  sortDirection: CustomerPurchaseHistorySortDirection,
) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return sortDirection === "date_asc"
    ? left.localeCompare(right)
    : right.localeCompare(left);
}

function compareNullableSortOrder(left: number | null, right: number | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

export function flattenCustomerPurchaseHistory(
  orders: CustomerHistoryOrder[],
  items: CustomerHistoryItem[],
  sortDirection: CustomerPurchaseHistorySortDirection = "date_asc",
): CustomerPurchaseHistoryRow[] {
  const ordersById = new Map<string, OrderMeta>(
    orders.map((order, index) => [
      order.id,
      { business_date: order.business_date, index },
    ]),
  );

  return items
    .flatMap((item) => {
      const order = ordersById.get(item.order_id);

      if (!order) {
        return [];
      }

      return [
        {
          order_id: item.order_id,
          business_date: order.business_date,
          product_name_snapshot: item.product_name_snapshot,
          quantity: item.quantity,
          unit_snapshot: item.unit_snapshot,
          unit_price: item.unit_price,
          line_total: item.line_total,
          sort_order: item.sort_order,
        },
      ];
    })
    .sort((left, right) => {
      const dateComparison = compareBusinessDate(
        left.business_date,
        right.business_date,
        sortDirection,
      );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      const leftOrder = ordersById.get(left.order_id);
      const rightOrder = ordersById.get(right.order_id);
      const orderComparison = (leftOrder?.index ?? 0) - (rightOrder?.index ?? 0);

      if (orderComparison !== 0) {
        return orderComparison;
      }

      return compareNullableSortOrder(left.sort_order, right.sort_order);
    });
}

export function sumCustomerPurchaseHistoryTotal(
  rows: CustomerPurchaseHistoryRow[],
): number {
  return rows.reduce((total, row) => {
    const value = Number(row.line_total ?? 0);

    return Number.isFinite(value) ? total + value : total;
  }, 0);
}
