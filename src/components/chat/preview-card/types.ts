import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import type { EntityType } from "@/src/lib/ai/resolve-schema";
import type { QueryAnswer } from "@/src/lib/ai/answer-query";

export type PreviewResolvedEntityPatch = {
  entity_type: EntityType;
  raw: string | null;
  resolved_id: string;
  resolved_name: string;
};

export type PreviewAddedItemPatch = {
  tempId: string;
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
};

export type PreviewCardPatch = {
  itemPrices: Record<number, number>;
  itemQuantities: Record<number, number>;
  amount: number | null;
  customer: PreviewResolvedEntityPatch | null;
  supplier: PreviewResolvedEntityPatch | null;
  itemProducts: Record<number, PreviewResolvedEntityPatch>;
  removedIndices?: number[];
  itemsAdded?: PreviewAddedItemPatch[];
};

export type PipelineTurnView = {
  id: string;
  userMessageId: string;
  validated: ValidatedIntent;
  answer?: QueryAnswer | null;
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
    removedIndices: [],
    itemsAdded: [],
  };
}
