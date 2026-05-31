import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedIntent } from "@/src/lib/ai/resolve-schema";
import { ValidateError } from "@/src/lib/ai/validate-errors";
import {
  validateResolvedIntent,
  type CustomerDebt,
  type ProductMaster,
  type ProductMasterValue,
  type ValidationMasters,
} from "@/src/lib/ai/validator";

export type ValidateSupabaseClient = Pick<SupabaseClient, "from">;

type ProductMasterRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | string | null;
  cost_price: number | string | null;
};

type CustomerDebtRow = {
  id: string;
  debt_total: number | string | null;
};

export type ValidateIntentInput = {
  resolved: ResolvedIntent;
  ownerId: string;
  supabase?: ValidateSupabaseClient;
  masters?: ValidationMasters;
};

function validationKindForIntent(intent: ResolvedIntent["intent"]) {
  if (
    intent === "create_order" ||
    intent === "record_payment" ||
    intent === "create_purchase"
  ) {
    return "writable" as const;
  }

  if (
    intent === "query_debt" ||
    intent === "query_inventory" ||
    intent === "query_sales"
  ) {
    return "query" as const;
  }

  if (intent === "edit_order") {
    return "edit" as const;
  }

  if (intent === "undo") {
    return "undo" as const;
  }

  return "none" as const;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function productMasterFromRows(rows: ProductMasterRow[] | null): ProductMaster {
  const products: ProductMaster = new Map<string, ProductMasterValue>();

  for (const row of rows ?? []) {
    products.set(row.id, {
      name: row.name,
      unit: row.unit,
      sell_price: toNullableNumber(row.sell_price),
      cost_price: toNullableNumber(row.cost_price),
    });
  }

  return products;
}

function debtMasterFromRow(row: CustomerDebtRow | null): CustomerDebt {
  const debts: CustomerDebt = new Map();

  if (row) {
    debts.set(row.id, {
      debt_total: toNullableNumber(row.debt_total) ?? 0,
    });
  }

  return debts;
}

function uniqueResolvedProductIds(resolved: ResolvedIntent) {
  return [
    ...new Set(
      resolved.items
        .map((item) =>
          item.resolution.status === "resolved"
            ? item.resolution.resolved_id
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

async function fetchProductMasters(
  supabase: ValidateSupabaseClient,
  ownerId: string,
  productIds: string[],
) {
  if (productIds.length === 0) {
    return new Map() as ProductMaster;
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,unit,sell_price,cost_price")
    .eq("owner_id", ownerId)
    .in("id", productIds);

  if (error) {
    throw new ValidateError(
      "MASTER_FETCH_FAILED",
      "Could not fetch product masters.",
      { cause: error },
    );
  }

  return productMasterFromRows(data as ProductMasterRow[] | null);
}

async function fetchCustomerDebt(
  supabase: ValidateSupabaseClient,
  ownerId: string,
  customerId: string | null,
) {
  if (!customerId) {
    return new Map() as CustomerDebt;
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id,debt_total")
    .eq("owner_id", ownerId)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new ValidateError(
      "MASTER_FETCH_FAILED",
      "Could not fetch customer debt.",
      { cause: error },
    );
  }

  return debtMasterFromRow(data as CustomerDebtRow | null);
}

export async function validateIntent({
  resolved,
  ownerId,
  supabase,
  masters,
}: ValidateIntentInput) {
  if (!resolved) {
    throw new ValidateError("INVALID_INPUT");
  }

  try {
    if (masters) {
      return validateResolvedIntent(resolved, masters);
    }

    if (validationKindForIntent(resolved.intent) !== "writable") {
      return validateResolvedIntent(resolved, {
        products: new Map(),
        debts: new Map(),
      });
    }

    if (!supabase) {
      throw new ValidateError("MASTER_FETCH_FAILED");
    }

    const productIds = uniqueResolvedProductIds(resolved);
    const products = await fetchProductMasters(supabase, ownerId, productIds);
    const customerId =
      resolved.intent === "record_payment" &&
      resolved.customer?.status === "resolved"
        ? resolved.customer.resolved_id
        : null;
    const debts = await fetchCustomerDebt(supabase, ownerId, customerId);

    return validateResolvedIntent(resolved, {
      products,
      debts,
    });
  } catch (error) {
    if (error instanceof ValidateError) {
      throw error;
    }

    throw new ValidateError("VALIDATE_FAILED", "VALIDATE_FAILED", {
      cause: error,
    });
  }
}
