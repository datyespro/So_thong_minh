import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviewCard } from "@/src/components/chat/preview-card/preview-card";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import type { PreviewCardPatch } from "@/src/components/chat/preview-card";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";
import {
  baseValidated,
  customerUnresolvedIssue,
  item,
  missingCustomer,
  missingCustomerIssue,
  missingPriceIssue,
  needsConfirmationCustomer,
  notFoundCustomer,
  productUnresolvedIssue,
  resolvedCustomer,
  resolvedSupplier,
  warningIssue,
} from "@/tests/chat/preview-card-fixtures";

function renderCard(
  validated: ValidatedIntent,
  options: {
    patched?: PreviewCardPatch;
    isLive?: boolean;
  } = {},
) {
  return renderToStaticMarkup(
    createElement(PreviewCard, {
      validated,
      patched: options.patched ?? createEmptyPreviewCardPatch(),
      isLive: options.isLive ?? true,
      onPatchChange: () => undefined,
    }),
  );
}

describe("PreviewCard", () => {
  it("renders a complete create_order card with enabled confirm button", () => {
    const html = renderCard(baseValidated());

    expect(html).toContain("Đơn bán hàng");
    expect(html).toContain("anh Hùng");
    expect(html).toContain("xi măng");
    expect(html).toContain('value="20"');
    expect(html).toContain("Nhập giá bao");
    expect(html).toContain('value="80000"');
    expect(html).toContain("1.600.000 đ");
    expect(html).toContain("Ghi đơn");
    expect(html).not.toContain('data-testid="issue-panel-blocking"');
    expect(html).not.toContain('disabled=""');
  });

  it("renders each non-order kind in the correct branch", () => {
    const queryHtml = renderCard(
      baseValidated({
        intent: "query_debt",
        kind: "query",
        raw_text: "anh Hùng còn nợ bao nhiêu?",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
    );
    const noneHtml = renderCard(
      baseValidated({
        intent: "small_talk",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
    );
    const editHtml = renderCard(
      baseValidated({
        intent: "edit_order",
        kind: "edit",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
    );

    expect(queryHtml).toContain("Câu hỏi");
    expect(queryHtml).toContain("anh Hùng còn nợ bao nhiêu?");
    expect(queryHtml).toContain("Phần trả lời sẽ có ở bước sau ạ.");
    expect(queryHtml).not.toContain("Ghi đơn");
    expect(noneHtml).toContain("Dạ, em nghe ạ.");
    expect(noneHtml).not.toContain("Đơn bán hàng");
    expect(editHtml).toContain("Tính năng này sẽ có ở bước sau ạ.");
    expect(editHtml).not.toContain("Ghi đơn");
  });

  it("renders create_purchase and record_payment labels", () => {
    const purchaseHtml = renderCard(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: resolvedSupplier,
      }),
    );
    const paymentHtml = renderCard(
      baseValidated({
        intent: "record_payment",
        customer: resolvedCustomer,
        items: [],
        effective_amount: 500000,
      }),
    );

    expect(purchaseHtml).toContain("Đơn nhập hàng");
    expect(purchaseHtml).toContain("Nhà cung cấp A");
    expect(purchaseHtml).toContain("Ghi nhập hàng");
    expect(paymentHtml).toContain("Thu / trả nợ");
    expect(paymentHtml).toContain("500.000 đ");
    expect(paymentHtml).toContain("Ghi thu nợ");
  });

  it("shows an inline price patch input for missing price and enables after patch", () => {
    const missingPrice = baseValidated({
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

    const initialHtml = renderCard(missingPrice);
    const patchedHtml = renderCard(missingPrice, {
      patched: {
        ...createEmptyPreviewCardPatch(),
        itemPrices: { 0: 100000 },
      },
    });

    expect(initialHtml).toContain("Nhập giá bao");
    expect(initialHtml).toContain("Còn thiếu thông tin");
    expect(initialHtml).toContain('disabled=""');
    expect(patchedHtml).toContain("2.000.000 đ");
    expect(patchedHtml).not.toContain("chưa có giá");
    expect(patchedHtml).not.toContain('disabled=""');
  });

  it("does not offer customer patching for missing customer", () => {
    const html = renderCard(
      baseValidated({
        customer: missingCustomer,
        issues: [missingCustomerIssue()],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain("Chưa rõ bán cho ai");
    expect(html).toContain("Còn thiếu thông tin");
    expect(html).not.toContain("Nhập tên");
  });

  it("renders customer candidate choices and create-new choice for unresolved customer", () => {
    const html = renderCard(
      baseValidated({
        customer: needsConfirmationCustomer,
        issues: [customerUnresolvedIssue()],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain('data-testid="customer-confirm-panel"');
    expect(html).toContain("chị Lan");
    expect(html).toContain("Không phải, thêm khách mới");
    expect(html).not.toContain("score");
  });

  it("renders create customer panel for not_found customer", () => {
    const html = renderCard(
      baseValidated({
        customer: notFoundCustomer,
        issues: [customerUnresolvedIssue()],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain('data-testid="customer-create-panel"');
    expect(html).toContain("Thêm");
    expect(html).toContain("anh Phát");
  });

  it("does not offer product creation for a not_found product", () => {
    const html = renderCard(
      baseValidated({
        items: [
          item({
            product_name: "đinh",
            resolution: {
              raw: "đinh",
              entity_type: "product",
              status: "not_found",
              resolved_id: null,
              resolved_name: null,
              confidence: 0,
              candidates: [],
            },
            issues: [productUnresolvedIssue()],
          }),
        ],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain('data-testid="product-not-found"');
    expect(html).toContain("Chưa có hàng");
    expect(html).not.toContain("Thêm hàng");
    expect(html).toContain('disabled=""');
  });

  it("enables confirm when only warnings remain", () => {
    const html = renderCard(
      baseValidated({
        issues: [warningIssue()],
        ready_for_preview: true,
        blocking_count: 0,
        warning_count: 1,
      }),
    );

    expect(html).toContain('data-testid="issue-panel-warning"');
    expect(html).not.toContain('disabled=""');
  });

  it("removes patch inputs and buttons when frozen", () => {
    const html = renderCard(
      baseValidated({
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
      }),
      {
        isLive: false,
        patched: {
          ...createEmptyPreviewCardPatch(),
          itemPrices: { 0: 100000 },
        },
      },
    );

    expect(html).toContain('data-testid="preview-card-frozen"');
    expect(html).toContain("2.000.000 đ");
    expect(html).not.toContain("Nhập giá");
    expect(html).not.toContain("Ghi đơn");
  });
});
