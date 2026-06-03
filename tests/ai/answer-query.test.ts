import { describe, expect, it } from "vitest";
import {
  answerQuery,
  type AnswerQuerySupabaseClient,
} from "@/src/lib/ai/answer-query";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import type {
  ValidatedIntent,
  ValidatedLineItem,
} from "@/src/lib/ai/validate-schema";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";

type QueryCall = {
  table: string;
  columns: string | null;
  filters: Array<{
    method: "eq" | "gte" | "lte";
    column: string;
    value: unknown;
  }>;
  mode: "rows" | "single";
};

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createAnswerSupabase(handler: (call: QueryCall) => QueryResult) {
  const calls: QueryCall[] = [];

  const supabase = {
    from(table: string) {
      const call: QueryCall = {
        table,
        columns: null,
        filters: [],
        mode: "rows",
      };
      calls.push(call);

      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ method: "eq", column, value });
          return builder;
        },
        gte(column: string, value: unknown) {
          call.filters.push({ method: "gte", column, value });
          return builder;
        },
        lte(column: string, value: unknown) {
          call.filters.push({ method: "lte", column, value });
          return builder;
        },
        maybeSingle() {
          call.mode = "single";
          return Promise.resolve(handler(call));
        },
        then<TResult1 = QueryResult, TResult2 = never>(
          onfulfilled?:
            | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(handler(call)).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  } as unknown as AnswerQuerySupabaseClient;

  return { supabase, calls };
}

const resolvedCustomer: ResolvedEntity = {
  raw: "anh Hùng",
  entity_type: "customer",
  status: "resolved",
  resolved_id: "customer-hung",
  resolved_name: "anh Hùng",
  confidence: 1,
  candidates: [],
};

const ambiguousCustomer: ResolvedEntity = {
  raw: "Lan",
  entity_type: "customer",
  status: "ambiguous",
  resolved_id: null,
  resolved_name: null,
  confidence: 0.62,
  candidates: [
    {
      id: "customer-lan-1",
      name: "chị Lan",
      score: 0.72,
      matched_on: "fuzzy",
      matched_value: "chị Lan",
    },
    {
      id: "customer-lan-2",
      name: "cô Lan",
      score: 0.69,
      matched_on: "fuzzy",
      matched_value: "cô Lan",
    },
  ],
};

const notFoundCustomer: ResolvedEntity = {
  raw: "anh Phát",
  entity_type: "customer",
  status: "not_found",
  resolved_id: null,
  resolved_name: null,
  confidence: 0,
  candidates: [],
};

const resolvedProduct: ResolvedEntity = {
  raw: "xi măng",
  entity_type: "product",
  status: "resolved",
  resolved_id: "product-xi-mang",
  resolved_name: "xi măng",
  confidence: 1,
  candidates: [],
};

const ambiguousProduct: ResolvedEntity = {
  raw: "xi",
  entity_type: "product",
  status: "ambiguous",
  resolved_id: null,
  resolved_name: null,
  confidence: 0.66,
  candidates: [
    {
      id: "product-xi-mang",
      name: "xi măng",
      score: 0.82,
      matched_on: "fuzzy",
      matched_value: "xi",
    },
    {
      id: "product-xi-trang",
      name: "xi trắng",
      score: 0.74,
      matched_on: "fuzzy",
      matched_value: "xi",
    },
  ],
};

const notFoundProduct: ResolvedEntity = {
  raw: "ngói",
  entity_type: "product",
  status: "not_found",
  resolved_id: null,
  resolved_name: null,
  confidence: 0,
  candidates: [],
};

function productItem(
  overrides: Partial<ValidatedLineItem> = {},
): ValidatedLineItem {
  return {
    raw: "xi măng",
    product_name: "xi măng",
    quantity: null,
    unit: null,
    unit_price: null,
    confidence: 0.93,
    resolution: resolvedProduct,
    effective_quantity: null,
    effective_unit: null,
    effective_unit_price: null,
    line_total: null,
    issues: [],
    ...overrides,
  };
}

const extracted: ExtractedIntent = {
  intent: "query_debt",
  confidence: 0.93,
  raw_text: "anh Hùng nợ bao nhiêu",
  normalized_text: "anh hùng nợ bao nhiêu",
  language: "vi",
  entities: {
    customer_name: "anh Hùng",
    supplier_name: null,
    product_name: null,
    product_management: null,
    items: [],
    amount: null,
    payment_status: "unknown",
    payment_method: null,
    order_reference: null,
    business_date: null,
    time_range: {
      raw: null,
      kind: "unknown",
      start_date: null,
      end_date: null,
    },
  },
  missing_info: [],
  warnings: [],
  needs_confirmation: false,
  next_stage_hint: "resolve_entities",
};

function validatedQuery(
  overrides: Partial<ValidatedIntent> = {},
): ValidatedIntent {
  return {
    intent: "query_debt",
    kind: "query",
    raw_text: "anh Hùng nợ bao nhiêu",
    customer: resolvedCustomer,
    supplier: null,
    items: [],
    effective_amount: null,
    issues: [],
    ready_for_preview: false,
    blocking_count: 0,
    warning_count: 0,
    ...overrides,
  };
}

function salesExtracted(
  kind: ExtractedIntent["entities"]["time_range"]["kind"],
  raw: string | null,
): ExtractedIntent {
  return {
    ...extracted,
    intent: "query_sales",
    raw_text: raw ?? "bán bao nhiêu",
    entities: {
      ...extracted.entities,
      customer_name: null,
      time_range: {
        raw,
        kind,
        start_date: null,
        end_date: null,
      },
    },
  };
}

function inventoryExtracted(productName: string | null): ExtractedIntent {
  return {
    ...extracted,
    intent: "query_inventory",
    raw_text: productName ? `còn bao nhiêu ${productName}` : "còn bao nhiêu",
    normalized_text: productName ? `còn bao nhiêu ${productName}` : "còn bao nhiêu",
    entities: {
      ...extracted.entities,
      customer_name: null,
      product_name: productName,
    },
  };
}

function expectFilter(
  call: QueryCall,
  method: "eq" | "gte" | "lte",
  column: string,
  value: unknown,
) {
  expect(call.filters).toContainEqual({ method, column, value });
}

describe("answerQuery", () => {
  it("answers debt from v_customer_balances with an explicit owner filter", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: {
        customer_name: "anh Hùng",
        debt_total: "400000",
        last_order_at: "2026-05-31T08:00:00.000Z",
        last_payment_at: null,
      },
      error: null,
    }));

    const result = await answerQuery({
      extracted,
      validated: validatedQuery(),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "debt",
      state: "found",
      customerName: "anh Hùng",
      debt: 400000,
      lastOrderAt: "2026-05-31T08:00:00.000Z",
      lastPaymentAt: null,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("v_customer_balances");
    expectFilter(calls[0], "eq", "owner_id", "owner-a");
    expectFilter(calls[0], "eq", "customer_id", "customer-hung");
  });

  it("keeps zero debt as a found customer", async () => {
    const { supabase } = createAnswerSupabase(() => ({
      data: {
        customer_name: "anh Hùng",
        debt_total: 0,
        last_order_at: null,
        last_payment_at: null,
      },
      error: null,
    }));

    const result = await answerQuery({
      extracted,
      validated: validatedQuery(),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toMatchObject({
      type: "debt",
      state: "found",
      debt: 0,
    });
  });

  it("does not guess debt when the customer is ambiguous", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: { ...extracted, entities: { ...extracted.entities, customer_name: "Lan" } },
      validated: validatedQuery({ customer: ambiguousCustomer }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "debt",
      state: "ambiguous",
      askedName: "Lan",
      candidates: ["chị Lan", "cô Lan"],
    });
    expect(calls).toHaveLength(0);
  });

  it("returns not_found without reading debt for an unresolved customer", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: {
        ...extracted,
        entities: { ...extracted.entities, customer_name: "anh Phát" },
      },
      validated: validatedQuery({ customer: notFoundCustomer }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "debt",
      state: "not_found",
      askedName: "anh Phát",
    });
    expect(calls).toHaveLength(0);
  });

  it("answers today sales and sums daily rows", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [
        {
          orders_count: "1",
          total_revenue: "200000",
          total_paid: "50000",
          total_debt: "150000",
        },
        {
          orders_count: 1,
          total_revenue: 400000,
          total_paid: 0,
          total_debt: 400000,
        },
      ],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("today", "hôm nay"),
      validated: validatedQuery({
        intent: "query_sales",
        customer: null,
        raw_text: "hôm nay bán bao nhiêu",
      }),
      ownerId: "owner-a",
      supabase,
      now: dayjs.tz("2026-06-17T10:00:00", APP_TIME_ZONE),
    });

    expect(result).toEqual({
      type: "sales",
      state: "ok",
      rangeKind: "today",
      rangeLabel: "hôm nay",
      from: "2026-06-17",
      to: "2026-06-17",
      orders: 2,
      revenue: 600000,
      paid: 50000,
      debt: 550000,
    });
    expect(calls[0].table).toBe("v_daily_sales");
    expectFilter(calls[0], "eq", "owner_id", "owner-a");
    expectFilter(calls[0], "eq", "business_date", "2026-06-17");
  });

  it("defaults sales to today only when no time range was asked", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("unknown", null),
      validated: validatedQuery({ intent: "query_sales", customer: null }),
      ownerId: "owner-a",
      supabase,
      now: dayjs.tz("2026-06-17T10:00:00", APP_TIME_ZONE),
    });

    expect(result).toMatchObject({
      type: "sales",
      state: "ok",
      rangeKind: "today",
      orders: 0,
      revenue: 0,
    });
    expectFilter(calls[0], "eq", "business_date", "2026-06-17");
  });

  it("answers this_month sales from the first day through today", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [
        {
          orders_count: 3,
          total_revenue: 900000,
          total_paid: 300000,
          total_debt: 600000,
        },
      ],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("this_month", "tháng này"),
      validated: validatedQuery({ intent: "query_sales", customer: null }),
      ownerId: "owner-a",
      supabase,
      now: dayjs.tz("2026-06-17T10:00:00", APP_TIME_ZONE),
    });

    expect(result).toMatchObject({
      type: "sales",
      state: "ok",
      rangeKind: "this_month",
      rangeLabel: "tháng này",
      from: "2026-06-01",
      to: "2026-06-17",
      orders: 3,
      revenue: 900000,
      paid: 300000,
      debt: 600000,
    });
    expectFilter(calls[0], "eq", "owner_id", "owner-a");
    expectFilter(calls[0], "gte", "business_date", "2026-06-01");
    expectFilter(calls[0], "lte", "business_date", "2026-06-17");
  });

  it("answers this_week sales from Monday through today", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [
        {
          orders_count: 2,
          total_revenue: 600000,
          total_paid: 100000,
          total_debt: 500000,
        },
      ],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("this_week", "tuần này"),
      validated: validatedQuery({ intent: "query_sales", customer: null }),
      ownerId: "owner-a",
      supabase,
      now: dayjs.tz("2026-06-17T10:00:00", APP_TIME_ZONE),
    });

    expect(result).toMatchObject({
      type: "sales",
      state: "ok",
      rangeKind: "this_week",
      rangeLabel: "tuần này",
      from: "2026-06-15",
      to: "2026-06-17",
      orders: 2,
      revenue: 600000,
      paid: 100000,
      debt: 500000,
    });
    expectFilter(calls[0], "eq", "owner_id", "owner-a");
    expectFilter(calls[0], "gte", "business_date", "2026-06-15");
    expectFilter(calls[0], "lte", "business_date", "2026-06-17");
  });

  it("answers yesterday sales for only yesterday's business date", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("yesterday", "hôm qua"),
      validated: validatedQuery({ intent: "query_sales", customer: null }),
      ownerId: "owner-a",
      supabase,
      now: dayjs.tz("2026-06-17T10:00:00", APP_TIME_ZONE),
    });

    expect(result).toMatchObject({
      type: "sales",
      state: "ok",
      rangeKind: "yesterday",
      from: "2026-06-16",
      to: "2026-06-16",
      orders: 0,
    });
    expectFilter(calls[0], "eq", "business_date", "2026-06-16");
  });

  it("returns unsupported_range for an explicit unsupported range without querying", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: [],
      error: null,
    }));

    const result = await answerQuery({
      extracted: salesExtracted("custom", "quý này"),
      validated: validatedQuery({ intent: "query_sales", customer: null }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "sales",
      state: "unsupported_range",
    });
    expect(calls).toHaveLength(0);
  });

  it("answers inventory from products with explicit owner and product filters", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: {
        name: "xi măng",
        current_stock: "144.00",
        unit: "bao",
      },
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        raw_text: "còn bao nhiêu xi măng",
        items: [productItem()],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "found",
      productName: "xi măng",
      stock: 144,
      unit: "bao",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("products");
    expect(calls[0].columns).toBe("name,current_stock,unit");
    expect(calls[0].mode).toBe("single");
    expectFilter(calls[0], "eq", "owner_id", "owner-a");
    expectFilter(calls[0], "eq", "id", "product-xi-mang");
  });

  it("keeps zero inventory as a found product", async () => {
    const { supabase } = createAnswerSupabase(() => ({
      data: {
        name: "xi măng",
        current_stock: 0,
        unit: "bao",
      },
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [productItem()],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toMatchObject({
      type: "inventory",
      state: "found",
      stock: 0,
      unit: "bao",
    });
  });

  it("keeps negative inventory as a found product", async () => {
    const { supabase } = createAnswerSupabase(() => ({
      data: {
        name: "xi măng",
        current_stock: "-3.50",
        unit: "bao",
      },
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [productItem()],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toMatchObject({
      type: "inventory",
      state: "found",
      stock: -3.5,
      unit: "bao",
    });
  });

  it("returns inventory not_found without reading for an unresolved product", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("ngói"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [
          productItem({
            raw: "ngói",
            product_name: "ngói",
            resolution: notFoundProduct,
          }),
        ],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "not_found",
      askedName: "ngói",
    });
    expect(calls).toHaveLength(0);
  });

  it("returns inventory not_found without reading when a product has no resolved id", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [
          productItem({
            resolution: {
              ...resolvedProduct,
              resolved_id: null,
            },
          }),
        ],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "not_found",
      askedName: "xi măng",
    });
    expect(calls).toHaveLength(0);
  });

  it("returns inventory ambiguous without reading for ambiguous products", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [
          productItem({
            raw: "xi",
            product_name: "xi",
            resolution: ambiguousProduct,
          }),
        ],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "ambiguous",
      askedName: "xi",
      candidates: ["xi măng", "xi trắng"],
    });
    expect(calls).toHaveLength(0);
  });

  it("returns inventory ambiguous for needs_confirmation products", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [
          productItem({
            raw: "xi",
            product_name: "xi",
            resolution: {
              ...ambiguousProduct,
              status: "needs_confirmation",
            },
          }),
        ],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toMatchObject({
      type: "inventory",
      state: "ambiguous",
      askedName: "xi",
      candidates: ["xi măng", "xi trắng"],
    });
    expect(calls).toHaveLength(0);
  });

  it("returns inventory not_found for an empty item list", async () => {
    const { supabase, calls } = createAnswerSupabase(() => ({
      data: null,
      error: null,
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        raw_text: "còn bao nhiêu xi măng",
        items: [],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "not_found",
      askedName: "xi măng",
    });
    expect(calls).toHaveLength(0);
  });

  it("returns inventory read_error without exposing stock numbers", async () => {
    const { supabase } = createAnswerSupabase(() => ({
      data: null,
      error: { message: "permission denied" },
    }));

    const result = await answerQuery({
      extracted: inventoryExtracted("xi măng"),
      validated: validatedQuery({
        intent: "query_inventory",
        customer: null,
        items: [productItem()],
      }),
      ownerId: "owner-a",
      supabase,
    });

    expect(result).toEqual({
      type: "inventory",
      state: "read_error",
      message: "Em chưa đọc được tồn kho trong sổ, bác thử lại ạ.",
    });
  });
});
