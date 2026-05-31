import type { EntityType } from "@/src/lib/ai/resolve-schema";

export async function confirmAliasInBackground(
  entityType: EntityType,
  entityId: string,
  alias: string | null,
) {
  if (!alias?.trim()) {
    return;
  }

  try {
    const response = await fetch("/api/ai/confirm-alias", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
        alias,
      }),
    });

    if (!response.ok) {
      console.error("confirmAlias failed", response.status);
      return;
    }

    const result: unknown = await response.json();

    if (
      typeof result === "object" &&
      result !== null &&
      "ok" in result &&
      result.ok === false
    ) {
      console.error("confirmAlias failed", result);
    }
  } catch (error) {
    console.error("confirmAlias failed", error);
  }
}
