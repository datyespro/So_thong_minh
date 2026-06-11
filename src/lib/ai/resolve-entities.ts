import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveOne,
  type EntityRow,
} from "@/src/lib/ai/entity-resolver";
import { EntityResolveError } from "@/src/lib/ai/resolve-errors";
import type { ExtractedIntent, ExtractedItem } from "@/src/lib/ai/intent-schema";
import type {
  EntityType,
  ResolvedEntity,
  ResolvedIntent,
} from "@/src/lib/ai/resolve-schema";

export type OwnerEntityRows = {
  customers: EntityRow[];
  products: EntityRow[];
  suppliers: EntityRow[];
};

export type EntitySupabaseClient = Pick<SupabaseClient, "from">;

type EntityTable = "customers" | "products" | "suppliers";

type DbEntityRow = {
  id: string;
  name: string;
  aliases: string[] | null;
};

export type ResolveEntitiesInput = {
  intent: ExtractedIntent;
  ownerId: string;
  supabase?: EntitySupabaseClient;
  entityRows?: OwnerEntityRows;
};

function normalizeDbRows(rows: DbEntityRow[] | null): EntityRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  }));
}

async function fetchEntityTable(
  supabase: EntitySupabaseClient,
  table: EntityTable,
  ownerId: string,
): Promise<EntityRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id,name,aliases")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    throw new EntityResolveError(
      "OWNER_FETCH_FAILED",
      `Could not fetch ${table}.`,
      { cause: error },
    );
  }

  return normalizeDbRows(data as DbEntityRow[] | null);
}

export async function fetchOwnerEntities(
  supabase: EntitySupabaseClient,
  ownerId: string,
): Promise<OwnerEntityRows> {
  const [customers, products, suppliers] = await Promise.all([
    fetchEntityTable(supabase, "customers", ownerId),
    fetchEntityTable(supabase, "products", ownerId),
    fetchEntityTable(supabase, "suppliers", ownerId),
  ]);

  return {
    customers,
    products,
    suppliers,
  };
}

function syntheticItemFromProductName(
  productName: string,
  intentConfidence: number,
): ExtractedItem {
  return {
    raw: productName,
    product_name: productName,
    quantity: null,
    unit: null,
    unit_price: null,
    line_total: null,
    confidence: intentConfidence,
  };
}

function entityHasRaw(entity: ResolvedEntity | null): entity is ResolvedEntity {
  return Boolean(entity?.raw);
}

function resolveOverallStatus(entities: ResolvedEntity[]) {
  const meaningfulEntities = entities.filter(entityHasRaw);

  if (
    meaningfulEntities.some((entity) => entity.status === "not_found")
  ) {
    return "has_unresolved" as const;
  }

  if (
    meaningfulEntities.some(
      (entity) =>
        entity.status === "needs_confirmation" ||
        entity.status === "ambiguous",
    )
  ) {
    return "needs_confirmation" as const;
  }

  return "all_resolved" as const;
}

function rowsForEntityType(
  entityType: EntityType,
  ownerRows: OwnerEntityRows,
): EntityRow[] {
  if (entityType === "customer") {
    return ownerRows.customers;
  }

  if (entityType === "supplier") {
    return ownerRows.suppliers;
  }

  return ownerRows.products;
}

export async function resolveEntities({
  intent,
  ownerId,
  supabase,
  entityRows,
}: ResolveEntitiesInput): Promise<ResolvedIntent> {
  if (!intent) {
    throw new EntityResolveError("EMPTY_INTENT");
  }

  let ownerRows: OwnerEntityRows;

  try {
    if (entityRows) {
      ownerRows = entityRows;
    } else {
      if (!supabase) {
        throw new EntityResolveError("OWNER_FETCH_FAILED");
      }

      ownerRows = await fetchOwnerEntities(supabase, ownerId);
    }

    const customer = resolveOne(
      intent.entities.customer_name,
      "customer",
      rowsForEntityType("customer", ownerRows),
    );
    const supplier = resolveOne(
      intent.entities.supplier_name,
      "supplier",
      rowsForEntityType("supplier", ownerRows),
    );

    const sourceItems =
      intent.entities.items.length > 0
        ? intent.entities.items
        : intent.entities.product_name
          ? [
              syntheticItemFromProductName(
                intent.entities.product_name,
                intent.confidence,
              ),
            ]
          : [];

    const items = sourceItems.map((item) => ({
      ...item,
      resolution: resolveOne(
        item.product_name,
        "product",
        rowsForEntityType("product", ownerRows),
      ),
    }));

    const overallStatus = resolveOverallStatus([
      customer,
      supplier,
      ...items.map((item) => item.resolution),
    ]);

    return {
      intent: intent.intent,
      raw_text: intent.raw_text,
      amount: intent.entities.amount,
      ...(intent.entities.business_date != null
        ? { business_date: intent.entities.business_date }
        : {}),
      payment_status: intent.entities.payment_status,
      payment_method: intent.entities.payment_method,
      customer,
      supplier,
      items,
      overall_status: overallStatus,
      needs_confirmation: overallStatus !== "all_resolved",
    };
  } catch (error) {
    if (error instanceof EntityResolveError) {
      throw error;
    }

    throw new EntityResolveError("RESOLVE_FAILED", "RESOLVE_FAILED", {
      cause: error,
    });
  }
}
