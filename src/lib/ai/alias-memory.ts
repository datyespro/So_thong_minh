import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVi } from "@/src/lib/ai/normalize";
import type { EntityType } from "@/src/lib/ai/resolve-schema";
import type { ActionResult } from "@/src/types/action-result";

export type AliasMemorySupabaseClient = Pick<SupabaseClient, "from">;

type AliasEntityTable = "customers" | "products" | "suppliers";

type AliasRow = {
  aliases: string[] | null;
};

export type ConfirmAliasInput = {
  supabase: AliasMemorySupabaseClient;
  ownerId: string;
  entityType: EntityType;
  entityId: string;
  alias: string;
};

const TABLE_BY_ENTITY_TYPE: Record<EntityType, AliasEntityTable> = {
  customer: "customers",
  product: "products",
  supplier: "suppliers",
};

function cleanAliases(aliases: string[] | null): string[] {
  return Array.isArray(aliases)
    ? aliases.filter((alias): alias is string => typeof alias === "string")
    : [];
}

export async function confirmAlias({
  supabase,
  ownerId,
  entityType,
  entityId,
  alias,
}: ConfirmAliasInput): Promise<ActionResult<{ aliases: string[] }>> {
  const trimmedAlias = alias.trim();
  const normalizedAlias = normalizeVi(trimmedAlias);

  if (!entityId.trim() || !normalizedAlias) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Alias confirmation request is invalid.",
    };
  }

  const table = TABLE_BY_ENTITY_TYPE[entityType];
  const { data, error } = await supabase
    .from(table)
    .select("aliases")
    .eq("owner_id", ownerId)
    .eq("id", entityId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Could not read entity aliases.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Entity was not found for this owner.",
    };
  }

  const aliases = cleanAliases((data as AliasRow).aliases);
  const alreadyExists = aliases.some(
    (existingAlias) => normalizeVi(existingAlias) === normalizedAlias,
  );

  if (alreadyExists) {
    return {
      ok: true,
      data: {
        aliases,
      },
    };
  }

  const nextAliases = [...aliases, trimmedAlias];
  const { data: updatedData, error: updateError } = await supabase
    .from(table)
    .update({ aliases: nextAliases })
    .eq("owner_id", ownerId)
    .eq("id", entityId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("aliases")
    .maybeSingle();

  if (updateError) {
    return {
      ok: false,
      code: "db_error",
      message: "Could not update entity aliases.",
    };
  }

  if (!updatedData) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Entity was not found for this owner.",
    };
  }

  return {
    ok: true,
    data: {
      aliases: cleanAliases((updatedData as AliasRow).aliases),
    },
  };
}
