import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dayjs } from "dayjs";
import type { ExtractedIntent } from "@/src/lib/ai/intent-schema";
import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";

export type AnswerQuerySupabaseClient = Pick<SupabaseClient, "from">;

type SupportedSalesRangeKind =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month";

type CustomerBalanceRow = {
  customer_name: string;
  debt_total: number | string | null;
  last_order_at: string | null;
  last_payment_at: string | null;
};

type DailySalesRow = {
  orders_count: number | string | null;
  total_revenue: number | string | null;
  total_paid: number | string | null;
  total_debt: number | string | null;
};

type ProductInventoryRow = {
  name: string;
  current_stock: number | string | null;
  unit: string | null;
};

type QueryReadError = {
  state: "read_error";
  message: string;
};

export type DebtQueryAnswer =
  | {
      type: "debt";
      state: "found";
      customerName: string;
      debt: number;
      lastOrderAt: string | null;
      lastPaymentAt: string | null;
    }
  | {
      type: "debt";
      state: "ambiguous";
      askedName: string;
      candidates: string[];
    }
  | {
      type: "debt";
      state: "not_found";
      askedName: string;
    }
  | ({ type: "debt" } & QueryReadError);

export type SalesQueryAnswer =
  | {
      type: "sales";
      state: "ok";
      rangeKind: SupportedSalesRangeKind;
      rangeLabel: string;
      from: string;
      to: string;
      orders: number;
      revenue: number;
      paid: number;
      debt: number;
    }
  | {
      type: "sales";
      state: "unsupported_range";
    }
  | ({ type: "sales" } & QueryReadError);

export type InventoryQueryAnswer =
  | {
      type: "inventory";
      state: "found";
      productName: string;
      stock: number;
      unit: string;
    }
  | {
      type: "inventory";
      state: "ambiguous";
      askedName: string;
      candidates: string[];
    }
  | {
      type: "inventory";
      state: "not_found";
      askedName: string;
    }
  | ({ type: "inventory" } & QueryReadError);

export type QueryAnswer =
  | DebtQueryAnswer
  | SalesQueryAnswer
  | InventoryQueryAnswer;

export type AnswerQueryInput = {
  extracted: ExtractedIntent;
  validated: ValidatedIntent;
  ownerId: string;
  supabase: AnswerQuerySupabaseClient;
  now?: Dayjs;
};

type SalesRange =
  | {
      state: "supported";
      kind: SupportedSalesRangeKind;
      label: string;
      from: string;
      to: string;
    }
  | { state: "unsupported" };

const SALES_RANGE_LABELS: Record<SupportedSalesRangeKind, string> = {
  today: "hôm nay",
  yesterday: "hôm qua",
  this_week: "tuần này",
  this_month: "tháng này",
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function askedCustomerName(extracted: ExtractedIntent, customer: ResolvedEntity | null) {
  return (
    customer?.raw?.trim() ||
    extracted.entities.customer_name?.trim() ||
    extracted.raw_text
  );
}

function candidateNames(customer: ResolvedEntity | null) {
  return (customer?.candidates ?? []).map((candidate) => candidate.name);
}

function primaryProductItem(validated: ValidatedIntent) {
  return validated.items[0] ?? null;
}

function askedProductName(extracted: ExtractedIntent, validated: ValidatedIntent) {
  const item = primaryProductItem(validated);

  return (
    item?.resolution.raw?.trim() ||
    item?.product_name?.trim() ||
    item?.raw?.trim() ||
    extracted.entities.product_name?.trim() ||
    extracted.raw_text
  );
}

function productCandidateNames(item: ValidatedIntent["items"][number] | null) {
  return (item?.resolution.candidates ?? []).map((candidate) => candidate.name);
}

function resolveSalesRange(extracted: ExtractedIntent, now = dayjs()): SalesRange {
  const timeRange = extracted.entities.time_range;
  const raw = timeRange.raw?.trim() ?? "";
  const today = now.tz(APP_TIME_ZONE).startOf("day");
  const kind = timeRange.kind;

  if (kind === "unknown") {
    if (raw) {
      return { state: "unsupported" };
    }

    return {
      state: "supported",
      kind: "today",
      label: SALES_RANGE_LABELS.today,
      from: today.format("YYYY-MM-DD"),
      to: today.format("YYYY-MM-DD"),
    };
  }

  if (kind === "today") {
    return {
      state: "supported",
      kind,
      label: SALES_RANGE_LABELS[kind],
      from: today.format("YYYY-MM-DD"),
      to: today.format("YYYY-MM-DD"),
    };
  }

  if (kind === "yesterday") {
    const yesterday = today.subtract(1, "day");

    return {
      state: "supported",
      kind,
      label: SALES_RANGE_LABELS[kind],
      from: yesterday.format("YYYY-MM-DD"),
      to: yesterday.format("YYYY-MM-DD"),
    };
  }

  if (kind === "this_week") {
    const daysSinceMonday = (today.day() + 6) % 7;

    return {
      state: "supported",
      kind,
      label: SALES_RANGE_LABELS[kind],
      from: today.subtract(daysSinceMonday, "day").format("YYYY-MM-DD"),
      to: today.format("YYYY-MM-DD"),
    };
  }

  if (kind === "this_month") {
    return {
      state: "supported",
      kind,
      label: SALES_RANGE_LABELS[kind],
      from: today.startOf("month").format("YYYY-MM-DD"),
      to: today.format("YYYY-MM-DD"),
    };
  }

  return { state: "unsupported" };
}

async function answerDebt({
  extracted,
  validated,
  ownerId,
  supabase,
}: AnswerQueryInput): Promise<DebtQueryAnswer> {
  const customer = validated.customer;
  const askedName = askedCustomerName(extracted, customer);

  if (customer?.status === "resolved" && customer.resolved_id) {
    const { data, error } = await supabase
      .from("v_customer_balances")
      .select("customer_name,debt_total,last_order_at,last_payment_at")
      .eq("owner_id", ownerId)
      .eq("customer_id", customer.resolved_id)
      .maybeSingle();

    if (error) {
      return {
        type: "debt",
        state: "read_error",
        message: "Em chưa đọc được công nợ trong sổ, bác thử lại ạ.",
      };
    }

    if (!data) {
      return {
        type: "debt",
        state: "not_found",
        askedName,
      };
    }

    const row = data as CustomerBalanceRow;

    return {
      type: "debt",
      state: "found",
      customerName: row.customer_name,
      debt: toNumber(row.debt_total),
      lastOrderAt: row.last_order_at,
      lastPaymentAt: row.last_payment_at,
    };
  }

  if (
    customer?.status === "ambiguous" ||
    customer?.status === "needs_confirmation" ||
    candidateNames(customer).length > 0
  ) {
    return {
      type: "debt",
      state: "ambiguous",
      askedName,
      candidates: candidateNames(customer),
    };
  }

  return {
    type: "debt",
    state: "not_found",
    askedName,
  };
}

async function answerSales({
  extracted,
  ownerId,
  supabase,
  now,
}: AnswerQueryInput): Promise<SalesQueryAnswer> {
  const range = resolveSalesRange(extracted, now);

  if (range.state === "unsupported") {
    return {
      type: "sales",
      state: "unsupported_range",
    };
  }

  let query = supabase
    .from("v_daily_sales")
    .select("business_date,orders_count,total_revenue,total_paid,total_debt")
    .eq("owner_id", ownerId);

  query =
    range.from === range.to
      ? query.eq("business_date", range.from)
      : query.gte("business_date", range.from).lte("business_date", range.to);

  const { data, error } = await query;

  if (error) {
    return {
      type: "sales",
      state: "read_error",
      message: "Em chưa đọc được doanh thu trong sổ, bác thử lại ạ.",
    };
  }

  const totals = (data as DailySalesRow[] | null ?? []).reduce(
    (sum, row) => ({
      orders: sum.orders + toNumber(row.orders_count),
      revenue: sum.revenue + toNumber(row.total_revenue),
      paid: sum.paid + toNumber(row.total_paid),
      debt: sum.debt + toNumber(row.total_debt),
    }),
    { orders: 0, revenue: 0, paid: 0, debt: 0 },
  );

  return {
    type: "sales",
    state: "ok",
    rangeKind: range.kind,
    rangeLabel: range.label,
    from: range.from,
    to: range.to,
    ...totals,
  };
}

async function answerInventory({
  extracted,
  validated,
  ownerId,
  supabase,
}: AnswerQueryInput): Promise<InventoryQueryAnswer> {
  const item = primaryProductItem(validated);
  const askedName = askedProductName(extracted, validated);

  if (!item) {
    return {
      type: "inventory",
      state: "not_found",
      askedName,
    };
  }

  const resolution = item.resolution;

  if (resolution.status === "resolved" && resolution.resolved_id) {
    const { data, error } = await supabase
      .from("products")
      .select("name,current_stock,unit")
      .eq("owner_id", ownerId)
      .eq("id", resolution.resolved_id)
      .maybeSingle();

    if (error) {
      return {
        type: "inventory",
        state: "read_error",
        message: "Em chưa đọc được tồn kho trong sổ, bác thử lại ạ.",
      };
    }

    if (!data) {
      return {
        type: "inventory",
        state: "not_found",
        askedName,
      };
    }

    const row = data as ProductInventoryRow;

    return {
      type: "inventory",
      state: "found",
      productName: row.name,
      stock: toNumber(row.current_stock),
      unit: row.unit ?? "",
    };
  }

  if (
    resolution.status === "ambiguous" ||
    resolution.status === "needs_confirmation"
  ) {
    return {
      type: "inventory",
      state: "ambiguous",
      askedName,
      candidates: productCandidateNames(item),
    };
  }

  return {
    type: "inventory",
    state: "not_found",
    askedName,
  };
}

export async function answerQuery(input: AnswerQueryInput): Promise<QueryAnswer | null> {
  if (input.validated.kind !== "query") {
    return null;
  }

  if (input.validated.intent === "query_debt") {
    return answerDebt(input);
  }

  if (input.validated.intent === "query_sales") {
    return answerSales(input);
  }

  if (input.validated.intent === "query_inventory") {
    return answerInventory(input);
  }

  return null;
}
