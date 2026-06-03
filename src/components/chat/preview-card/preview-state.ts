import type {
  ValidatedIntent,
  ValidatedLineItem,
  ValidationIssue,
} from "@/src/lib/ai/validate-schema";
import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import type {
  PreviewCardPatch,
  PreviewAddedItemPatch,
  PreviewResolvedEntityPatch,
} from "@/src/components/chat/preview-card/types";

export const ADDED_ITEM_INDEX_BASE = 10000;

export type PreviewDisplayItem = {
  index: number;
  tempId?: string;
  item: ValidatedLineItem;
  resolution: ResolvedEntity;
  name: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  needsQuantityPatch: boolean;
  needsPricePatch: boolean;
};

export type VisibleIssue = ValidationIssue & {
  itemName?: string;
};

export type PatchedPreviewState = {
  customer: ResolvedEntity | null;
  supplier: ResolvedEntity | null;
  items: PreviewDisplayItem[];
  total: number | null;
  amount: number | null;
  issues: VisibleIssue[];
  blockingCount: number;
  warningCount: number;
  canConfirm: boolean;
};

function hasPatch(record: Record<number, number>, index: number) {
  return Object.prototype.hasOwnProperty.call(record, index);
}

function displayPatchedItemName(
  item: ValidatedLineItem,
  resolution: ResolvedEntity,
) {
  return resolution.resolved_name ?? item.product_name ?? item.raw;
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toResolvedEntity(
  entity: ResolvedEntity | null,
  patch: PreviewResolvedEntityPatch | null,
): ResolvedEntity | null {
  if (!patch) {
    return entity;
  }

  return {
    raw: patch.raw,
    entity_type: patch.entity_type,
    status: "resolved",
    resolved_id: patch.resolved_id,
    resolved_name: patch.resolved_name,
    confidence: 1,
    candidates: [],
  };
}

function resolvedAddedProduct(item: PreviewAddedItemPatch): ResolvedEntity {
  return {
    raw: item.product_name,
    entity_type: "product",
    status: "resolved",
    resolved_id: item.product_id,
    resolved_name: item.product_name,
    confidence: 1,
    candidates: [],
  };
}

function addedPreviewDisplayItem(
  addedItem: PreviewAddedItemPatch,
  addedIndex: number,
): PreviewDisplayItem {
  const resolution = resolvedAddedProduct(addedItem);
  const lineTotal = addedItem.quantity * addedItem.unit_price;
  const item: ValidatedLineItem = {
    raw: addedItem.product_name,
    product_name: addedItem.product_name,
    quantity: addedItem.quantity,
    unit: addedItem.unit,
    unit_price: addedItem.unit_price,
    line_total: lineTotal,
    confidence: 1,
    resolution,
    effective_quantity: addedItem.quantity,
    effective_unit: addedItem.unit,
    effective_unit_price: addedItem.unit_price,
    issues: [],
  };

  return {
    index: ADDED_ITEM_INDEX_BASE + addedIndex,
    tempId: addedItem.tempId,
    item,
    resolution,
    name: addedItem.product_name,
    quantity: addedItem.quantity,
    unit: addedItem.unit,
    unitPrice: addedItem.unit_price,
    lineTotal,
    needsQuantityPatch: false,
    needsPricePatch: false,
  };
}

function noItemsIssueForIntent(validated: ValidatedIntent): VisibleIssue {
  return {
    code: "no_items",
    severity: "blocking",
    message:
      validated.intent === "create_order"
        ? "Chưa rõ bán hàng gì ạ."
        : "Chưa rõ nhập hàng gì ạ.",
    field_path: "items",
    item_index: null,
  };
}

function invalidAddedQuantityIssue(displayItem: PreviewDisplayItem): VisibleIssue {
  return {
    code: "invalid_quantity",
    severity: "blocking",
    message: `Số lượng của "${displayItem.name}" phải lớn hơn 0.`,
    field_path: `items[${displayItem.index}].quantity`,
    item_index: displayItem.index,
    itemName: displayItem.name,
  };
}

function shouldHideIssue(issue: ValidationIssue, patch: PreviewCardPatch) {
  // The payment card recomputes overpayment live against the freshly-fetched
  // current debt, so the validator's original-amount overpayment issue (which
  // goes stale the moment the amount is edited) is hidden here.
  if (issue.code === "overpayment") {
    return true;
  }

  if (
    (issue.code === "missing_customer" || issue.code === "customer_unresolved") &&
    patch.customer
  ) {
    return true;
  }

  if (
    (issue.code === "missing_supplier" || issue.code === "supplier_unresolved") &&
    patch.supplier
  ) {
    return true;
  }

  if (
    issue.code === "product_unresolved" &&
    issue.item_index !== null &&
    patch.itemProducts[issue.item_index]
  ) {
    return true;
  }

  if (
    issue.code === "missing_price" &&
    issue.item_index !== null &&
    isPositiveNumber(patch.itemPrices[issue.item_index])
  ) {
    return true;
  }

  if (
    issue.code === "price_autofilled" &&
    issue.item_index !== null &&
    isPositiveNumber(patch.itemPrices[issue.item_index])
  ) {
    return true;
  }

  if (
    issue.code === "invalid_quantity" &&
    issue.item_index !== null &&
    isPositiveNumber(patch.itemQuantities[issue.item_index])
  ) {
    return true;
  }

  if (
    (issue.code === "missing_amount" || issue.code === "invalid_amount") &&
    isPositiveNumber(patch.amount)
  ) {
    return true;
  }

  return false;
}

export function getPatchedPreviewState(
  validated: ValidatedIntent,
  patch: PreviewCardPatch,
): PatchedPreviewState {
  const customer = toResolvedEntity(validated.customer, patch.customer);
  const supplier = toResolvedEntity(validated.supplier, patch.supplier);
  const removedIndices = new Set(patch.removedIndices ?? []);
  const baseItems = validated.items.map((item, index): PreviewDisplayItem => {
    const hasQuantityPatch = hasPatch(patch.itemQuantities, index);
    const hasPricePatch = hasPatch(patch.itemPrices, index);
    const resolution = toResolvedEntity(
      item.resolution,
      patch.itemProducts[index] ?? null,
    ) ?? item.resolution;
    const quantity = hasQuantityPatch
      ? patch.itemQuantities[index]
      : item.effective_quantity;
    const unitPrice = hasPricePatch
      ? patch.itemPrices[index]
      : item.effective_unit_price;
    const lineTotal =
      isPositiveNumber(quantity) && isPositiveNumber(unitPrice)
        ? quantity * unitPrice
        : item.line_total;

    return {
      index,
      item,
      resolution,
      name: displayPatchedItemName(item, resolution),
      quantity: quantity ?? null,
      unit: item.effective_unit ?? item.unit ?? null,
      unitPrice: unitPrice ?? null,
      lineTotal: lineTotal ?? null,
      needsQuantityPatch:
        item.effective_quantity === null ||
        item.issues.some((issue) => issue.code === "invalid_quantity"),
      needsPricePatch:
        item.effective_unit_price === null ||
        item.issues.some((issue) => issue.code === "missing_price"),
    };
  });
  const items = [
    ...baseItems.filter((displayItem) => !removedIndices.has(displayItem.index)),
    ...(patch.itemsAdded ?? []).map(addedPreviewDisplayItem),
  ];

  const amount = patch.amount ?? validated.effective_amount;
  const itemTotal = items.reduce(
    (sum, item) => sum + (item.lineTotal ?? 0),
    0,
  );
  const total =
    validated.intent === "record_payment"
      ? amount
      : items.length === 0
        ? validated.effective_amount
        : itemTotal;

  const itemIssues = items.flatMap((displayItem) =>
    displayItem.item.issues.map((issue) => ({
      ...issue,
      itemName: displayItem.name,
    })),
  );
  const issues = [...validated.issues, ...itemIssues]
    .filter((issue) => !shouldHideIssue(issue, patch))
    // A purchase without a supplier is allowed (supplier_id is nullable); the
    // validator marks it blocking, so the UI downgrades it to a warning here.
    .map((issue) =>
      validated.intent === "create_purchase" && issue.code === "missing_supplier"
        ? { ...issue, severity: "warning" as const }
        : issue,
    );
  if (validated.items.length > 0 && items.length === 0) {
    issues.push(noItemsIssueForIntent(validated));
  }
  for (const displayItem of items) {
    if (displayItem.tempId && !isPositiveNumber(displayItem.quantity)) {
      issues.push(invalidAddedQuantityIssue(displayItem));
    }
  }
  const blockingCount = issues.filter(
    (issue) => issue.severity === "blocking",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return {
    customer,
    supplier,
    items,
    total: total ?? null,
    amount: amount ?? null,
    issues,
    blockingCount,
    warningCount,
    canConfirm: validated.kind === "writable" && blockingCount === 0,
  };
}

export function updateCustomerPatch(
  patch: PreviewCardPatch,
  entity: PreviewResolvedEntityPatch,
): PreviewCardPatch {
  return {
    ...patch,
    customer: entity,
  };
}

export function updateSupplierPatch(
  patch: PreviewCardPatch,
  entity: PreviewResolvedEntityPatch,
): PreviewCardPatch {
  return {
    ...patch,
    supplier: entity,
  };
}

export function updateItemProductPatch(
  patch: PreviewCardPatch,
  itemIndex: number,
  entity: PreviewResolvedEntityPatch,
): PreviewCardPatch {
  return {
    ...patch,
    itemProducts: {
      ...patch.itemProducts,
      [itemIndex]: entity,
    },
  };
}

export function updateItemPricePatch(
  patch: PreviewCardPatch,
  itemIndex: number,
  value: number | null,
): PreviewCardPatch {
  const itemPrices = { ...patch.itemPrices };

  if (isPositiveNumber(value)) {
    itemPrices[itemIndex] = value;
  } else {
    delete itemPrices[itemIndex];
  }

  return {
    ...patch,
    itemPrices,
  };
}

export function updateItemQuantityPatch(
  patch: PreviewCardPatch,
  itemIndex: number,
  value: number | null,
): PreviewCardPatch {
  const itemQuantities = { ...patch.itemQuantities };

  if (isPositiveNumber(value)) {
    itemQuantities[itemIndex] = value;
  } else {
    delete itemQuantities[itemIndex];
  }

  return {
    ...patch,
    itemQuantities,
  };
}

export function addItem(
  patch: PreviewCardPatch,
  newItem: PreviewAddedItemPatch,
): PreviewCardPatch {
  return {
    ...patch,
    itemsAdded: [...(patch.itemsAdded ?? []), newItem],
  };
}

export function updateAddedItemQuantity(
  patch: PreviewCardPatch,
  tempId: string,
  value: number | null,
): PreviewCardPatch {
  return {
    ...patch,
    itemsAdded: (patch.itemsAdded ?? []).map((item) =>
      item.tempId === tempId
        ? { ...item, quantity: isFiniteNumber(value) ? value : 0 }
        : item,
    ),
  };
}

export function updateAddedItemPrice(
  patch: PreviewCardPatch,
  tempId: string,
  value: number | null,
): PreviewCardPatch {
  return {
    ...patch,
    itemsAdded: (patch.itemsAdded ?? []).map((item) =>
      item.tempId === tempId
        ? { ...item, unit_price: isFiniteNumber(value) ? value : 0 }
        : item,
    ),
  };
}

export function removeAddedItem(
  patch: PreviewCardPatch,
  tempId: string,
): PreviewCardPatch {
  return {
    ...patch,
    itemsAdded: (patch.itemsAdded ?? []).filter((item) => item.tempId !== tempId),
  };
}

export function removeIndex(
  patch: PreviewCardPatch,
  originalIndex: number,
): PreviewCardPatch {
  const removedIndices = new Set(patch.removedIndices ?? []);
  removedIndices.add(originalIndex);

  return {
    ...patch,
    removedIndices: [...removedIndices],
  };
}

export function updateAmountPatch(
  patch: PreviewCardPatch,
  value: number | null,
): PreviewCardPatch {
  return {
    ...patch,
    amount: isPositiveNumber(value) ? value : null,
  };
}
