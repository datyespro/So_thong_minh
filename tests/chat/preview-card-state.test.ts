import { describe, expect, it } from "vitest";
import {
  ADDED_ITEM_INDEX_BASE,
  addItem,
  getPatchedPreviewState,
  removeAddedItem,
  removeIndex,
  updateAddedItemPrice,
  updateAddedItemQuantity,
  updateCustomerPatch,
  updateItemProductPatch,
  updateItemPricePatch,
  updateItemQuantityPatch,
  updateSupplierPatch,
} from "@/src/components/chat/preview-card/preview-state";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import {
  baseValidated,
  customerUnresolvedIssue,
  item,
  needsConfirmationCustomer,
  missingPriceIssue,
  priceAutofilledIssue,
  productUnresolvedIssue,
} from "@/tests/chat/preview-card-fixtures";

function lineItem(index: number) {
  const quantity = index + 1;
  const unitPrice = (index + 1) * 1000;
  const productName = `product-${index}`;
  const productId = `p${index}`;

  return item({
    raw: productName,
    product_name: productName,
    quantity,
    unit: "cai",
    unit_price: unitPrice,
    line_total: quantity * unitPrice,
    resolution: {
      raw: productName,
      entity_type: "product",
      status: "resolved",
      resolved_id: productId,
      resolved_name: productName,
      confidence: 1,
      candidates: [],
    },
    effective_quantity: quantity,
    effective_unit: "cai",
    effective_unit_price: unitPrice,
  });
}

function addedLine(overrides: Partial<NonNullable<ReturnType<typeof createEmptyPreviewCardPatch>["itemsAdded"]>[number]> = {}) {
  return {
    tempId: "add-1",
    product_id: "p9",
    product_name: "product-9",
    unit: "hop",
    quantity: 3,
    unit_price: 5000,
    ...overrides,
  };
}

describe("preview card patch state", () => {
  it("recomputes line total and removes a patched missing_price issue", () => {
    const validated = baseValidated({
      items: [
        item({
          unit_price: null,
          effective_unit_price: null,
          line_total: null,
          issues: [missingPriceIssue()],
        }),
      ],
      effective_amount: null,
      ready_for_preview: false,
      blocking_count: 1,
    });
    const patch = updateItemPricePatch(
      createEmptyPreviewCardPatch(),
      0,
      100000,
    );

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items[0].unitPrice).toBe(100000);
    expect(state.items[0].lineTotal).toBe(2000000);
    expect(state.total).toBe(2000000);
    expect(state.issues.some((issue) => issue.code === "missing_price")).toBe(
      false,
    );
    expect(state.blockingCount).toBe(0);
    expect(state.canConfirm).toBe(true);
  });

  it("keeps blocking issues when the patch is invalid or unrelated", () => {
    const validated = baseValidated({
      items: [
        item({
          unit_price: null,
          effective_unit_price: null,
          line_total: null,
          issues: [missingPriceIssue()],
        }),
      ],
      effective_amount: null,
      ready_for_preview: false,
      blocking_count: 1,
    });

    const state = getPatchedPreviewState(
      validated,
      createEmptyPreviewCardPatch(),
    );

    expect(state.issues.some((issue) => issue.code === "missing_price")).toBe(
      true,
    );
    expect(state.canConfirm).toBe(false);
  });

  it("removes an autofilled price warning after the user edits the price", () => {
    const validated = baseValidated({
      items: [
        item({
          product_name: "cát",
          effective_quantity: 5,
          effective_unit: "khối",
          effective_unit_price: 350000,
          line_total: 1750000,
          issues: [priceAutofilledIssue()],
        }),
      ],
      effective_amount: 1750000,
      issues: [],
      ready_for_preview: true,
      blocking_count: 0,
      warning_count: 1,
    });
    const patch = updateItemPricePatch(
      createEmptyPreviewCardPatch(),
      0,
      400000,
    );

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items[0].unitPrice).toBe(400000);
    expect(state.items[0].lineTotal).toBe(2000000);
    expect(state.total).toBe(2000000);
    expect(state.issues.some((issue) => issue.code === "price_autofilled")).toBe(
      false,
    );
    expect(state.canConfirm).toBe(true);
  });

  it("hides the validator's overpayment issue (the card checks it live)", () => {
    const validated = baseValidated({
      intent: "record_payment",
      items: [],
      effective_amount: 500000,
      issues: [
        {
          code: "overpayment",
          severity: "warning",
          message: "Số tiền 500000đ lớn hơn công nợ hiện tại (300000đ). Bác kiểm tra lại?",
          field_path: "amount",
          item_index: null,
        },
      ],
      ready_for_preview: true,
      blocking_count: 0,
      warning_count: 1,
    });

    const state = getPatchedPreviewState(validated, createEmptyPreviewCardPatch());

    expect(state.issues.some((issue) => issue.code === "overpayment")).toBe(false);
    expect(state.blockingCount).toBe(0);
  });

  it("downgrades a missing supplier to non-blocking for a purchase", () => {
    const validated = baseValidated({
      intent: "create_purchase",
      customer: null,
      supplier: null,
      items: [item()],
      issues: [
        {
          code: "missing_supplier",
          severity: "blocking",
          message: "Chưa rõ nhập hàng từ nhà cung cấp nào ạ.",
          field_path: "supplier",
          item_index: null,
        },
      ],
      ready_for_preview: false,
      blocking_count: 1,
    });

    const state = getPatchedPreviewState(validated, createEmptyPreviewCardPatch());

    const supplierIssue = state.issues.find(
      (issue) => issue.code === "missing_supplier",
    );
    expect(supplierIssue?.severity).toBe("warning");
    expect(state.blockingCount).toBe(0);
    expect(state.canConfirm).toBe(true);
  });

  it("removes supplier blocking issues after local supplier resolution", () => {
    const validated = baseValidated({
      intent: "create_purchase",
      customer: null,
      supplier: {
        raw: "Song Hong",
        entity_type: "supplier",
        status: "needs_confirmation",
        resolved_id: null,
        resolved_name: null,
        confidence: 0.73,
        candidates: [
          {
            id: "supplier-song-hong",
            name: "Sông Hồng",
            score: 0.73,
            matched_on: "fuzzy",
            matched_value: "Sông Hồng",
          },
        ],
      },
      issues: [
        {
          code: "missing_supplier",
          severity: "blocking",
          message: "Chưa rõ nhập hàng từ nhà cung cấp nào ạ.",
          field_path: "supplier",
          item_index: null,
        },
        {
          code: "supplier_unresolved",
          severity: "blocking",
          message: 'Có vài nhà cung cấp gần giống "Song Hong", cần chọn đúng.',
          field_path: "supplier",
          item_index: null,
        },
      ],
      ready_for_preview: false,
      blocking_count: 2,
    });
    const patch = updateSupplierPatch(createEmptyPreviewCardPatch(), {
      entity_type: "supplier",
      raw: "Song Hong",
      resolved_id: "supplier-song-hong",
      resolved_name: "Sông Hồng",
    });

    const state = getPatchedPreviewState(validated, patch);

    expect(state.supplier?.resolved_name).toBe("Sông Hồng");
    expect(
      state.issues.some(
        (issue) =>
          issue.code === "missing_supplier" || issue.code === "supplier_unresolved",
      ),
    ).toBe(false);
    expect(state.blockingCount).toBe(0);
    expect(state.canConfirm).toBe(true);
  });

  it("removes customer and product blocking issues after local resolution", () => {
    const validated = baseValidated({
      customer: needsConfirmationCustomer,
      issues: [customerUnresolvedIssue()],
      items: [
        item({
          resolution: {
            raw: "xi mang",
            entity_type: "product",
            status: "needs_confirmation",
            resolved_id: null,
            resolved_name: null,
            confidence: 0.7,
            candidates: [
              {
                id: "product-xi-mang",
                name: "xi măng",
                score: 0.7,
                matched_on: "fuzzy",
                matched_value: "xi măng",
              },
            ],
          },
          issues: [productUnresolvedIssue()],
        }),
      ],
      ready_for_preview: false,
      blocking_count: 2,
    });
    const withCustomer = updateCustomerPatch(createEmptyPreviewCardPatch(), {
      entity_type: "customer",
      raw: "Lan",
      resolved_id: "customer-lan",
      resolved_name: "chị Lan",
    });
    const patch = updateItemProductPatch(withCustomer, 0, {
      entity_type: "product",
      raw: "xi mang",
      resolved_id: "product-xi-mang",
      resolved_name: "xi măng",
    });

    const state = getPatchedPreviewState(validated, patch);

    expect(state.customer?.resolved_name).toBe("chị Lan");
    expect(state.items[0].resolution.resolved_name).toBe("xi măng");
    expect(state.issues.some((issue) => issue.severity === "blocking")).toBe(
      false,
    );
    expect(state.canConfirm).toBe(true);
  });

  it("appends added items with resolved product fields", () => {
    const validated = baseValidated({
      items: [lineItem(0), lineItem(1)],
      effective_amount: 5000,
    });
    const patch = addItem(createEmptyPreviewCardPatch(), addedLine());

    const state = getPatchedPreviewState(validated, patch);
    const added = state.items[2];

    expect(state.items).toHaveLength(3);
    expect(added).toMatchObject({
      index: ADDED_ITEM_INDEX_BASE,
      tempId: "add-1",
      name: "product-9",
      quantity: 3,
      unit: "hop",
      unitPrice: 5000,
      lineTotal: 15000,
      needsQuantityPatch: false,
      needsPricePatch: false,
    });
    expect(added.resolution).toMatchObject({
      entity_type: "product",
      status: "resolved",
      resolved_id: "p9",
      resolved_name: "product-9",
    });
  });

  it("updates added item quantity without writing indexed quantity patches", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const withAdded = addItem(createEmptyPreviewCardPatch(), addedLine());
    const patch = updateAddedItemQuantity(withAdded, "add-1", 7);

    const state = getPatchedPreviewState(validated, patch);
    const added = state.items.find((displayItem) => displayItem.tempId === "add-1");

    expect(patch.itemQuantities).toEqual({});
    expect(patch.itemsAdded?.[0]).toMatchObject({ quantity: 7 });
    expect(added?.quantity).toBe(7);
    expect(added?.lineTotal).toBe(7 * 5000);
  });

  it("updates added item price without writing indexed price patches", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const withAdded = addItem(createEmptyPreviewCardPatch(), addedLine());
    const patch = updateAddedItemPrice(withAdded, "add-1", 2000);

    const state = getPatchedPreviewState(validated, patch);
    const added = state.items.find((displayItem) => displayItem.tempId === "add-1");

    expect(patch.itemPrices).toEqual({});
    expect(patch.itemsAdded?.[0]).toMatchObject({ unit_price: 2000 });
    expect(added?.unitPrice).toBe(2000);
    expect(added?.lineTotal).toBe(3 * 2000);
  });

  it("ignores indexed quantity patches for added rows", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const withAdded = addItem(createEmptyPreviewCardPatch(), addedLine());
    const patch = updateItemQuantityPatch(withAdded, ADDED_ITEM_INDEX_BASE, 99);

    const state = getPatchedPreviewState(validated, patch);
    const added = state.items.find((displayItem) => displayItem.tempId === "add-1");

    expect(added?.quantity).toBe(3);
    expect(added?.lineTotal).toBe(15000);
  });

  it("removes an original item without reindexing the remaining items", () => {
    const validated = baseValidated({
      items: [lineItem(0), lineItem(1), lineItem(2)],
    });
    const patch = removeIndex(createEmptyPreviewCardPatch(), 1);

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items.map((displayItem) => displayItem.index)).toEqual([0, 2]);
    expect(state.items.some((displayItem) => displayItem.index === 1)).toBe(false);
  });

  it("keeps indexed quantity patches on the original row after filtering earlier rows", () => {
    const validated = baseValidated({
      items: [lineItem(0), lineItem(1), lineItem(2)],
    });
    const withQuantity = updateItemQuantityPatch(createEmptyPreviewCardPatch(), 2, 99);
    const patch = removeIndex(withQuantity, 0);

    const state = getPatchedPreviewState(validated, patch);
    const originalIndexTwo = state.items.find((displayItem) => displayItem.index === 2);

    expect(state.items.map((displayItem) => displayItem.index)).toEqual([1, 2]);
    expect(originalIndexTwo?.quantity).toBe(99);
    expect(originalIndexTwo?.lineTotal).toBe(99 * 3000);
  });

  it("can remove an original item and append a new item in the same patch", () => {
    const validated = baseValidated({
      items: [lineItem(0), lineItem(1)],
    });
    const patch = addItem(removeIndex(createEmptyPreviewCardPatch(), 0), addedLine());

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items.map((displayItem) => displayItem.index)).toEqual([1, 10000]);
    expect(state.items[0].name).toBe("product-1");
    expect(state.items[1].name).toBe("product-9");
  });

  it("removes an added item by temp id", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const withAdded = addItem(
      addItem(createEmptyPreviewCardPatch(), addedLine({ tempId: "add-1" })),
      addedLine({ tempId: "add-2", product_id: "p10", product_name: "product-10" }),
    );
    const patch = removeAddedItem(withAdded, "add-1");

    const state = getPatchedPreviewState(validated, patch);

    expect(patch.itemsAdded?.map((item) => item.tempId)).toEqual(["add-2"]);
    expect(state.items.map((displayItem) => displayItem.tempId).filter(Boolean)).toEqual([
      "add-2",
    ]);
  });

  it("builds added items with a complete synthetic validated line item", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const patch = addItem(createEmptyPreviewCardPatch(), addedLine());

    const state = getPatchedPreviewState(validated, patch);
    const added = state.items[1];

    expect(added.item).toMatchObject({
      raw: "product-9",
      product_name: "product-9",
      quantity: 3,
      unit: "hop",
      unit_price: 5000,
      line_total: 15000,
      effective_quantity: 3,
      effective_unit: "hop",
      effective_unit_price: 5000,
      issues: [],
    });
    expect(added.needsQuantityPatch).toBe(false);
    expect(added.needsPricePatch).toBe(false);
    expect(added.resolution.status).toBe("resolved");
    expect(added.resolution.resolved_id).toBe("p9");
  });

  it("adds a blocking no_items issue when all original items are removed", () => {
    const validated = baseValidated({ items: [lineItem(0)] });
    const patch = removeIndex(createEmptyPreviewCardPatch(), 0);

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items).toEqual([]);
    expect(state.issues).toContainEqual(
      expect.objectContaining({
        code: "no_items",
        severity: "blocking",
        field_path: "items",
        item_index: null,
      }),
    );
    expect(state.blockingCount).toBeGreaterThanOrEqual(1);
    expect(state.canConfirm).toBe(false);
  });

  it("adds a blocking issue when an added item quantity is not positive", () => {
    const validated = baseValidated({
      items: [],
      effective_amount: 500000,
      issues: [],
    });
    const patch = addItem(
      createEmptyPreviewCardPatch(),
      addedLine({ quantity: 0 }),
    );

    const state = getPatchedPreviewState(validated, patch);

    expect(state.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid_quantity",
        severity: "blocking",
        item_index: ADDED_ITEM_INDEX_BASE,
      }),
    );
    expect(state.blockingCount).toBeGreaterThanOrEqual(1);
    expect(state.canConfirm).toBe(false);
  });

  it("allows an added item with zero price and uses itemTotal instead of effective amount", () => {
    const validated = baseValidated({
      items: [],
      effective_amount: 500000,
      issues: [],
    });
    const patch = addItem(
      createEmptyPreviewCardPatch(),
      addedLine({ quantity: 2, unit_price: 0 }),
    );

    const state = getPatchedPreviewState(validated, patch);

    expect(state.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 0,
      lineTotal: 0,
    });
    expect(state.issues.some((issue) => issue.severity === "blocking")).toBe(false);
    expect(state.canConfirm).toBe(true);
    expect(state.total).toBe(0);
  });

  it("does not add the merge no_items rule when the original card had no items", () => {
    const validated = baseValidated({
      intent: "record_payment",
      items: [],
      effective_amount: 500000,
      issues: [],
    });

    const state = getPatchedPreviewState(validated, createEmptyPreviewCardPatch());

    expect(state.items).toEqual([]);
    expect(state.issues.some((issue) => issue.code === "no_items")).toBe(false);
    expect(state.canConfirm).toBe(true);
  });

  it("produces collectOrderItems-compatible payload fields after remove and add", () => {
    const validated = baseValidated({
      items: [lineItem(0), lineItem(1)],
    });
    const patch = addItem(removeIndex(createEmptyPreviewCardPatch(), 0), addedLine());

    const state = getPatchedPreviewState(validated, patch);
    const payload = state.items.map((displayItem) => ({
      product_id: displayItem.resolution.resolved_id,
      product_name_snapshot: displayItem.name,
      unit_snapshot: displayItem.unit,
      quantity: displayItem.quantity,
      unit_price: displayItem.unitPrice,
    }));

    expect(payload).toEqual([
      {
        product_id: "p1",
        product_name_snapshot: "product-1",
        unit_snapshot: "cai",
        quantity: 2,
        unit_price: 2000,
      },
      {
        product_id: "p9",
        product_name_snapshot: "product-9",
        unit_snapshot: "hop",
        quantity: 3,
        unit_price: 5000,
      },
    ]);
  });
});
