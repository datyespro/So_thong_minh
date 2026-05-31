import { describe, expect, it } from "vitest";
import {
  getPatchedPreviewState,
  updateCustomerPatch,
  updateItemProductPatch,
  updateItemPricePatch,
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
});
