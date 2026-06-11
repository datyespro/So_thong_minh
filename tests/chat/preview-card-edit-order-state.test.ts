import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addedItemFromCreatedProduct,
  addedItemFromProductCandidate,
  businessDateCommitInput,
  canRemoveOrderItem,
  entityPatchFromCandidate,
  entityPatchFromCreatedCustomer,
  formatPreviewBusinessDate,
  formatDeleteOrderSummary,
  getPreviewBusinessDate,
  getPreviewCardInteractionFlags,
  getOrderItemRemoveMode,
  shouldKeepDeleteOrderConfirmOpen,
} from "@/src/components/chat/preview-card/preview-card";
import { needsConfirmationCustomer } from "@/tests/chat/preview-card-fixtures";

describe("PreviewCard edit-order interaction flags", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the edit button only for a live committed sale order", () => {
    const liveCommitted = getPreviewCardInteractionFlags({
      intent: "create_order",
      isLive: true,
      hasCommitted: true,
      undone: false,
      isEditing: false,
      isResaving: false,
      canConfirm: true,
    });

    expect(liveCommitted.canShowEditOrderButton).toBe(true);
    expect(liveCommitted.canShowUndoButton).toBe(true);

    const locked = getPreviewCardInteractionFlags({
      intent: "create_order",
      isLive: false,
      hasCommitted: true,
      undone: false,
      isEditing: false,
      isResaving: false,
      canConfirm: true,
    });

    expect(locked.canShowEditOrderButton).toBe(false);
    expect(locked.canShowUndoButton).toBe(false);
  });

  it("reopens quantity and price editing while exposing only the edit-customer flag", () => {
    const editing = getPreviewCardInteractionFlags({
      intent: "create_order",
      isLive: true,
      hasCommitted: true,
      undone: false,
      isEditing: true,
      isResaving: false,
      canConfirm: true,
    });

    expect(editing.isReopeningSaleOrder).toBe(true);
    expect(editing.interactive).toBe(true);
    expect(editing.canEditCounterpartyAndProducts).toBe(false);
    expect(editing.canChangeCustomerInEdit).toBe(true);
    expect(editing.canEditItemsInEdit).toBe(true);
    expect(editing.canShowUndoButton).toBe(false);
    expect(editing.canShowResaveControls).toBe(true);
  });

  it("returns to committed controls after cancel-like state and never opens edit for non-sale cards", () => {
    const afterCancel = getPreviewCardInteractionFlags({
      intent: "create_order",
      isLive: true,
      hasCommitted: true,
      undone: false,
      isEditing: false,
      isResaving: false,
      canConfirm: true,
    });
    const purchase = getPreviewCardInteractionFlags({
      intent: "create_purchase",
      isLive: true,
      hasCommitted: true,
      undone: false,
      isEditing: false,
      isResaving: false,
      canConfirm: true,
    });

    expect(afterCancel.canShowResaveControls).toBe(false);
    expect(afterCancel.canShowEditOrderButton).toBe(true);
    expect(purchase.canShowEditOrderButton).toBe(false);
    expect(purchase.canShowUndoButton).toBe(true);
  });

  it("disables resave while saving or when the card cannot confirm", () => {
    expect(
      getPreviewCardInteractionFlags({
        intent: "create_order",
        isLive: true,
        hasCommitted: true,
        undone: false,
        isEditing: true,
        isResaving: true,
        canConfirm: true,
      }).resaveDisabled,
    ).toBe(true);
    expect(
      getPreviewCardInteractionFlags({
        intent: "create_order",
        isLive: true,
        hasCommitted: true,
        undone: false,
        isEditing: true,
        isResaving: true,
        canConfirm: true,
      }).canChangeCustomerInEdit,
    ).toBe(false);
    expect(
      getPreviewCardInteractionFlags({
        intent: "create_order",
        isLive: true,
        hasCommitted: true,
        undone: false,
        isEditing: true,
        isResaving: true,
        canConfirm: true,
      }).canEditItemsInEdit,
    ).toBe(false);

    expect(
      getPreviewCardInteractionFlags({
        intent: "create_order",
        isLive: true,
        hasCommitted: true,
        undone: false,
        isEditing: true,
        isResaving: false,
        canConfirm: false,
      }).resaveDisabled,
    ).toBe(true);
  });

  it("builds customer patches with the selected or created customer id", () => {
    const candidatePatch = entityPatchFromCandidate(
      needsConfirmationCustomer,
      needsConfirmationCustomer.candidates[0],
    );
    const createdPatch = entityPatchFromCreatedCustomer("anh Phát", {
      id: "customer-phat",
      name: "anh Phát",
    });

    expect(candidatePatch).toEqual({
      entity_type: "customer",
      raw: "Lan",
      resolved_id: "customer-lan",
      resolved_name: "chị Lan",
    });
    expect(createdPatch).toEqual({
      entity_type: "customer",
      raw: "anh Phát",
      resolved_id: "customer-phat",
      resolved_name: "anh Phát",
    });
  });

  it("uses today's date before commit and the committed business date after commit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T03:00:00+07:00"));

    const preCommitDate = getPreviewBusinessDate({
      intent: "create_order",
      hasCommitted: false,
    });
    const committedDate = getPreviewBusinessDate({
      intent: "create_order",
      hasCommitted: true,
      committedBusinessDate: "2026-06-01",
    });
    const recreatedPurchaseDate = getPreviewBusinessDate({
      intent: "create_purchase",
      hasCommitted: true,
      committedBusinessDate: "2026-06-01",
    });

    expect(preCommitDate).toBe("2026-06-02");
    expect(formatPreviewBusinessDate(preCommitDate ?? "")).toBe("02/06/2026");
    expect(committedDate).toBe("2026-06-01");
    expect(formatPreviewBusinessDate(committedDate ?? "")).toBe("01/06/2026");
    expect(recreatedPurchaseDate).toBe("2026-06-01");
    expect(
      getPreviewBusinessDate({
        intent: "record_payment",
        hasCommitted: false,
      }),
    ).toBeNull();
  });

  it("prefers the validated date before commit and only sends a date when present", () => {
    expect(
      getPreviewBusinessDate({
        intent: "create_order",
        hasCommitted: false,
        validatedBusinessDate: "2026-06-01",
      }),
    ).toBe("2026-06-01");
    expect(
      getPreviewBusinessDate({
        intent: "create_order",
        hasCommitted: true,
        committedBusinessDate: "2026-06-02",
        validatedBusinessDate: "2026-06-01",
      }),
    ).toBe("2026-06-02");
    expect(businessDateCommitInput("2026-06-01")).toEqual({
      business_date: "2026-06-01",
    });
    expect(businessDateCommitInput(null)).toEqual({});
  });

  it("builds added product items from a selected candidate or created product", () => {
    expect(
      addedItemFromProductCandidate(
        {
          id: "product-xi-mang",
          name: "Xi măng",
          score: 0.9,
          matched_on: "fuzzy",
          matched_value: "xi mang",
        },
        "temp-candidate",
      ),
    ).toEqual({
      tempId: "temp-candidate",
      product_id: "product-xi-mang",
      product_name: "Xi măng",
      unit: "cái",
      quantity: 1,
      unit_price: 0,
    });

    expect(
      addedItemFromProductCandidate(
        {
          id: "product-priced",
          name: "Xi măng",
          unit: "bao",
          sell_price: 80000,
          score: 1,
          matched_on: "name_exact",
          matched_value: "Xi măng",
        },
        "temp-priced",
      ).unit_price,
    ).toBe(80000);

    expect(
      addedItemFromProductCandidate(
        {
          id: "product-null-price",
          name: "Cát vàng",
          unit: "khối",
          sell_price: null,
          score: 1,
          matched_on: "name_exact",
          matched_value: "Cát vàng",
        },
        "temp-null-price",
      ).unit_price,
    ).toBe(0);

    expect(
      addedItemFromProductCandidate(
        {
          id: "product-undefined-price",
          name: "Gạch",
          unit: "viên",
          score: 1,
          matched_on: "name_exact",
          matched_value: "Gạch",
        },
        "temp-undefined-price",
      ).unit_price,
    ).toBe(0);

    for (const { unit, tempId } of [
      { unit: "bao", tempId: "temp-bao" },
      { unit: "cây", tempId: "temp-cay" },
      { unit: "cái", tempId: "temp-cai" },
    ]) {
      expect(
        addedItemFromProductCandidate(
          {
            id: `product-${unit}`,
            name: `Hàng ${unit}`,
            unit,
            score: 1,
            matched_on: "name_exact",
            matched_value: `Hàng ${unit}`,
          },
          tempId,
        ).unit,
      ).toBe(unit);
    }

    expect(
      addedItemFromProductCandidate(
        {
          id: "product-null-unit",
          name: "Hàng thiếu đơn vị",
          unit: null,
          score: 1,
          matched_on: "name_exact",
          matched_value: "Hàng thiếu đơn vị",
        },
        "temp-null-unit",
      ).unit,
    ).toBe("cái");

    expect(
      addedItemFromCreatedProduct(
        { id: "product-cat", name: "Cát vàng", unit: "khối", sell_price: null },
        "temp-created",
      ),
    ).toEqual({
      tempId: "temp-created",
      product_id: "product-cat",
      product_name: "Cát vàng",
      unit: "khối",
      quantity: 1,
      unit_price: 0,
    });

    expect(
      addedItemFromCreatedProduct(
        { id: "product-thep", name: "Thép phi 12", unit: "cây", sell_price: 80000 },
        "temp-created-priced",
      ),
    ).toEqual({
      tempId: "temp-created-priced",
      product_id: "product-thep",
      product_name: "Thép phi 12",
      unit: "cây",
      quantity: 1,
      unit_price: 80000,
    });
  });

  it("allows item deletion only when more than one row remains", () => {
    expect(canRemoveOrderItem(2)).toBe(true);
    expect(canRemoveOrderItem(1)).toBe(false);
    expect(canRemoveOrderItem(0)).toBe(false);
  });

  it("keeps pre-commit single-item delete disabled but confirms the last committed edit item", () => {
    expect(
      getOrderItemRemoveMode({
        itemCount: 1,
        isReopeningSaleOrder: false,
      }),
    ).toBe("disabled");

    expect(
      getOrderItemRemoveMode({
        itemCount: 1,
        isReopeningSaleOrder: true,
      }),
    ).toBe("confirm-delete-order");
  });

  it("switches from row deletion to order-delete confirmation after an edit leaves one item", () => {
    const beforeRemovingOneRow = getOrderItemRemoveMode({
      itemCount: 2,
      isReopeningSaleOrder: true,
    });
    const afterRemovingOneRow = getOrderItemRemoveMode({
      itemCount: 1,
      isReopeningSaleOrder: true,
    });

    expect(beforeRemovingOneRow).toBe("remove-item");
    expect(afterRemovingOneRow).toBe("confirm-delete-order");
  });

  it("keeps the delete-order modal open only for a live committed one-item sale edit", () => {
    const base = {
      kind: "writable" as const,
      intent: "create_order" as const,
      isEditing: true,
      isLive: true,
      hasCommitted: true,
      undone: false,
      itemCount: 1,
    };

    expect(shouldKeepDeleteOrderConfirmOpen(base)).toBe(true);
    expect(
      shouldKeepDeleteOrderConfirmOpen({
        ...base,
        hasCommitted: false,
      }),
    ).toBe(false);
    expect(
      shouldKeepDeleteOrderConfirmOpen({
        ...base,
        itemCount: 2,
      }),
    ).toBe(false);
    expect(
      shouldKeepDeleteOrderConfirmOpen({
        ...base,
        undone: true,
      }),
    ).toBe(false);
  });

  it("formats the delete-order summary with a safe empty-item fallback", () => {
    expect(
      formatDeleteOrderSummary({
        customerName: "anh Tuấn",
        total: 100000,
        firstItem: {
          name: "xi măng",
          quantity: 2,
          unit: "bao",
        },
      }),
    ).toBe("Đơn anh Tuấn - 2 bao xi măng - 100.000 đ");

    expect(
      formatDeleteOrderSummary({
        customerName: "anh Tuấn",
        total: 100000,
        firstItem: null,
      }),
    ).toBe("Đơn anh Tuấn - 100.000 đ");

    expect(
      formatDeleteOrderSummary({
        customerName: null,
        total: null,
        firstItem: null,
      }),
    ).toBe("Đơn này - Chưa rõ tổng tiền");
  });
});
