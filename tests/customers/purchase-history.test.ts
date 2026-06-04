import { describe, expect, it } from "vitest";
import {
  flattenCustomerPurchaseHistory,
  sumCustomerPurchaseHistoryTotal,
  type CustomerHistoryItem,
  type CustomerHistoryOrder,
  type CustomerPurchaseHistoryRow,
} from "@/src/lib/customers/purchase-history";

function makeHistoryRow(
  overrides: Partial<CustomerPurchaseHistoryRow> = {},
): CustomerPurchaseHistoryRow {
  return {
    order_id: "order-1",
    business_date: "2026-06-02",
    product_name_snapshot: "Item",
    quantity: 1,
    unit_snapshot: "cai",
    unit_price: 1000,
    line_total: 1000,
    sort_order: 0,
    ...overrides,
  };
}

describe("flattenCustomerPurchaseHistory", () => {
  it("returns one row per item for a single order", () => {
    const rows = flattenCustomerPurchaseHistory(
      [{ id: "order-1", business_date: "2026-06-02" }],
      [
        {
          order_id: "order-1",
          product_name_snapshot: "Xi măng",
          quantity: "2.5",
          unit_snapshot: "bao",
          unit_price: "80000",
          line_total: "200000",
          sort_order: 0,
        },
        {
          order_id: "order-1",
          product_name_snapshot: "Cát vàng",
          quantity: 1,
          unit_snapshot: "khối",
          unit_price: 250000,
          line_total: 250000,
          sort_order: 1,
        },
      ],
    );

    expect(rows).toEqual([
      {
        order_id: "order-1",
        business_date: "2026-06-02",
        product_name_snapshot: "Xi măng",
        quantity: "2.5",
        unit_snapshot: "bao",
        unit_price: "80000",
        line_total: "200000",
        sort_order: 0,
      },
      {
        order_id: "order-1",
        business_date: "2026-06-02",
        product_name_snapshot: "Cát vàng",
        quantity: 1,
        unit_snapshot: "khối",
        unit_price: 250000,
        line_total: 250000,
        sort_order: 1,
      },
    ]);
  });

  it("defaults to date_asc when no sort direction is provided", () => {
    const rows = flattenCustomerPurchaseHistory(
      [
        { id: "older", business_date: "2026-06-01" },
        { id: "newer", business_date: "2026-06-03" },
      ],
      [
        {
          order_id: "older",
          product_name_snapshot: "Cũ",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 0,
        },
        {
          order_id: "newer",
          product_name_snapshot: "Mới",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 2000,
          line_total: 2000,
          sort_order: 0,
        },
      ],
    );

    expect(rows.map((row) => row.order_id)).toEqual(["older", "newer"]);
  });

  it("sorts multiple orders by business_date ascending for date_asc", () => {
    const rows = flattenCustomerPurchaseHistory(
      [
        { id: "newer", business_date: "2026-06-03" },
        { id: "older", business_date: "2026-06-01" },
      ],
      [
        {
          order_id: "newer",
          product_name_snapshot: "Mới",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 2000,
          line_total: 2000,
          sort_order: 0,
        },
        {
          order_id: "older",
          product_name_snapshot: "Cũ",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 0,
        },
      ],
      "date_asc",
    );

    expect(rows.map((row) => row.order_id)).toEqual(["older", "newer"]);
  });

  it("sorts multiple orders by business_date descending for date_desc", () => {
    const rows = flattenCustomerPurchaseHistory(
      [
        { id: "older", business_date: "2026-06-01" },
        { id: "newer", business_date: "2026-06-03" },
      ],
      [
        {
          order_id: "older",
          product_name_snapshot: "Cũ",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 0,
        },
        {
          order_id: "newer",
          product_name_snapshot: "Mới",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 2000,
          line_total: 2000,
          sort_order: 0,
        },
      ],
      "date_desc",
    );

    expect(rows.map((row) => row.order_id)).toEqual(["newer", "older"]);
  });

  it("sorts items from the same order by sort_order ascending with null last", () => {
    const rows = flattenCustomerPurchaseHistory(
      [{ id: "order-1", business_date: "2026-06-02" }],
      [
        {
          order_id: "order-1",
          product_name_snapshot: "Null",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: null,
        },
        {
          order_id: "order-1",
          product_name_snapshot: "Hai",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 2,
        },
        {
          order_id: "order-1",
          product_name_snapshot: "Một",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 1,
        },
      ],
    );

    expect(rows.map((row) => row.product_name_snapshot)).toEqual([
      "Một",
      "Hai",
      "Null",
    ]);
  });

  it("drops items whose order_id is not in the order map", () => {
    const rows = flattenCustomerPurchaseHistory(
      [{ id: "order-1", business_date: "2026-06-02" }],
      [
        {
          order_id: "missing-order",
          product_name_snapshot: "Không hợp lệ",
          quantity: 1,
          unit_snapshot: "cái",
          unit_price: 1000,
          line_total: 1000,
          sort_order: 0,
        },
      ],
    );

    expect(rows).toEqual([]);
  });

  it("does not mutate input arrays or objects", () => {
    const orders: CustomerHistoryOrder[] = [
      { id: "order-1", business_date: "2026-06-01" },
      { id: "order-2", business_date: "2026-06-02" },
    ];
    const items: CustomerHistoryItem[] = [
      {
        order_id: "order-1",
        product_name_snapshot: "Một",
        quantity: 1,
        unit_snapshot: "cái",
        unit_price: 1000,
        line_total: 1000,
        sort_order: 1,
      },
      {
        order_id: "order-2",
        product_name_snapshot: "Hai",
        quantity: 2,
        unit_snapshot: "cái",
        unit_price: 2000,
        line_total: 4000,
        sort_order: 0,
      },
    ];
    const ordersBefore = structuredClone(orders);
    const itemsBefore = structuredClone(items);

    flattenCustomerPurchaseHistory(orders, items);

    expect(orders).toEqual(ordersBefore);
    expect(items).toEqual(itemsBefore);
  });

  it("returns an empty list for empty inputs", () => {
    expect(flattenCustomerPurchaseHistory([], [])).toEqual([]);
  });
});

describe("sumCustomerPurchaseHistoryTotal", () => {
  it("sums multiple number line totals", () => {
    expect(
      sumCustomerPurchaseHistoryTotal([
        makeHistoryRow({ line_total: 100000 }),
        makeHistoryRow({ line_total: 60000 }),
      ]),
    ).toBe(160000);
  });

  it("sums numeric string line totals from Supabase", () => {
    expect(
      sumCustomerPurchaseHistoryTotal([
        makeHistoryRow({ line_total: "100000" }),
        makeHistoryRow({ line_total: "60000" }),
      ]),
    ).toBe(160000);
  });

  it("returns zero for empty rows", () => {
    expect(sumCustomerPurchaseHistoryTotal([])).toBe(0);
  });

  it("ignores invalid, null, and undefined line totals", () => {
    expect(
      sumCustomerPurchaseHistoryTotal([
        makeHistoryRow({ line_total: "invalid" }),
        makeHistoryRow({ line_total: null }),
        makeHistoryRow({ line_total: undefined }),
        makeHistoryRow({ line_total: 50000 }),
      ]),
    ).toBe(50000);
  });

  it("does not mutate input rows", () => {
    const rows = [
      makeHistoryRow({ line_total: 100000 }),
      makeHistoryRow({ line_total: "60000" }),
    ];
    const rowsBefore = structuredClone(rows);

    sumCustomerPurchaseHistoryTotal(rows);

    expect(rows).toEqual(rowsBefore);
  });

  it("uses stored line_total instead of quantity times unit_price", () => {
    expect(
      sumCustomerPurchaseHistoryTotal([
        makeHistoryRow({
          quantity: 999,
          unit_price: 999,
          line_total: 100,
        }),
      ]),
    ).toBe(100);
  });
});
