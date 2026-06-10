import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import type { EntityCandidate, EntityType } from "@/src/lib/ai/resolve-schema";
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

export type ProductManagementUpdateAction = "set_unit" | "set_price";

export type ProductManagementAction = ProductManagementUpdateAction | "create";

export type ProductManagementTarget =
  | { unit: string; sell_price?: never }
  | { unit?: never; sell_price: number };

export type ProductManagementProduct = {
  id: string;
  name: string;
  unit: string | null;
  sell_price: number | null;
};

export type ProductManagementCandidate = EntityCandidate & {
  unit: string | null;
  sell_price: number | null;
};

export type ProductManagementPreview =
  | {
      status: "not_found";
      action: ProductManagementUpdateAction;
      product_raw: string;
    }
  | {
      status: "needs_choice";
      action: ProductManagementUpdateAction;
      product_raw: string;
      candidates: ProductManagementCandidate[];
      target: ProductManagementTarget;
    }
  | {
      status: "ready";
      action: ProductManagementUpdateAction;
      product: ProductManagementProduct;
      target: ProductManagementTarget;
    }
  | {
      status: "saved";
      action: ProductManagementUpdateAction;
      product: ProductManagementProduct;
      target: ProductManagementTarget;
    }
  | {
      status: "create_draft";
      action: "create";
      product_raw: string;
      draft: {
        name: string;
        unit: string;
        sell_price: number | null;
      };
    }
  | {
      status: "create_duplicate";
      action: "create";
      product_raw: string;
      product: ProductManagementProduct;
    }
  | {
      status: "created";
      action: "create";
      product: ProductManagementProduct;
    };

export type PipelineTurnView = {
  id: string;
  userMessageId: string;
  validated: ValidatedIntent;
  answer?: QueryAnswer | null;
  productManagementPreview?: ProductManagementPreview | null;
  terminalText?: string | null;
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
