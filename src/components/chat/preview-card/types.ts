import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import type { EntityType } from "@/src/lib/ai/resolve-schema";

export type PreviewResolvedEntityPatch = {
  entity_type: EntityType;
  raw: string | null;
  resolved_id: string;
  resolved_name: string;
};

export type PreviewCardPatch = {
  itemPrices: Record<number, number>;
  itemQuantities: Record<number, number>;
  amount: number | null;
  customer: PreviewResolvedEntityPatch | null;
  supplier: PreviewResolvedEntityPatch | null;
  itemProducts: Record<number, PreviewResolvedEntityPatch>;
};

export type PipelineTurnView = {
  id: string;
  userMessageId: string;
  validated: ValidatedIntent;
  patched: PreviewCardPatch;
};

export function createEmptyPreviewCardPatch(): PreviewCardPatch {
  return {
    itemPrices: {},
    itemQuantities: {},
    amount: null,
    customer: null,
    supplier: null,
    itemProducts: {},
  };
}
