import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProductPatchForItem,
  PreviewCard,
  ProductCreatePanel,
} from "@/src/components/chat/preview-card/preview-card";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import { getPatchedPreviewState } from "@/src/components/chat/preview-card/preview-state";
import type {
  PreviewCardPatch,
  ProductManagementPreview,
} from "@/src/components/chat/preview-card";
import type { QueryAnswer } from "@/src/lib/ai/answer-query";
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
    answer?: QueryAnswer | null;
    productManagementPreview?: ProductManagementPreview | null;
    onPickSample?: (text: string) => void;
  } = {},
) {
  return renderToStaticMarkup(
    createElement(PreviewCard, {
      validated,
      answer: options.answer ?? null,
      productManagementPreview: options.productManagementPreview ?? null,
      patched: options.patched ?? createEmptyPreviewCardPatch(),
      isLive: options.isLive ?? true,
      onPickSample: options.onPickSample,
      onPatchChange: () => undefined,
    }),
  );
}

describe("PreviewCard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a complete create_order card with enabled confirm button", () => {
    const html = renderCard(baseValidated());

    expect(html).toContain("Đơn bán hàng");
    expect(html).toContain("anh Hùng");
    expect(html).toContain("xi măng");
    expect(html).toContain("Đơn vị");
    expect(html).toContain(">bao</p>");
    expect(html).toContain('value="20"');
    expect(html).not.toContain('value="20 bao"');
    expect(html).toContain("Nhập giá bao");
    expect(html).toContain('value="80000"');
    expect(html).toContain("1.600.000 đ");
    expect(html).toContain("Ghi đơn");
    expect(html).toContain(">Bỏ</button>");
    expect(html).not.toContain('data-testid="issue-panel-blocking"');
    expect(html).not.toContain('disabled=""');
  });

  it("shows today's business date before commit for order and purchase cards only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T03:00:00+07:00"));

    const orderHtml = renderCard(baseValidated());
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

    expect(orderHtml).toContain("Ngày: 02/06/2026");
    expect(purchaseHtml).toContain("Ngày: 02/06/2026");
    expect(paymentHtml).not.toContain("Ngày:");
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
    const manageProductHtml = renderCard(
      baseValidated({
        intent: "manage_product",
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
    expect(manageProductHtml).toContain("Tính năng quản lý hàng qua chat em đang hoàn thiện");
    expect(manageProductHtml).not.toContain("Em chưa rõ ý câu này");
    expect(editHtml).toContain("Tính năng này sẽ có ở bước sau ạ.");
    expect(editHtml).not.toContain("Ghi đơn");
  });

  it("renders capability help and chips for matched none intent", () => {
    const html = renderCard(
      baseValidated({
        intent: "unknown",
        kind: "none",
        raw_text: "ghi đơn thế nào",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      { onPickSample: () => undefined },
    );

    expect(html).toContain(
      "Dạ bác nhắn kiểu: Bán cho [tên khách] [số lượng] [tên hàng] [giá].",
    );
    expect(html).toContain("Bán cho anh Hùng 5 bao xi măng 90k");
    expect(html).toContain('data-testid="capability-chip-row"');
  });

  it("renders product-management not_found without save controls", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "not_found",
          action: "set_unit",
          product_raw: "gạch siêu lạ",
        },
      },
    );

    expect(html).toContain('data-testid="product-management-not-found"');
    expect(html).toContain("chưa tìm thấy hàng");
    expect(html).toContain("gạch siêu lạ");
    expect(html).not.toContain(">Lưu<");
    expect(html).not.toContain("Thêm mặt hàng");
  });

  it("renders a set_unit product-management preview with save and cancel", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "ready",
          action: "set_unit",
          product: {
            id: "product-xi-mang",
            name: "Xi măng",
            unit: "cái",
            sell_price: null,
          },
          target: { unit: "bao" },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-ready"');
    expect(html).toContain("Đổi đơn vị hàng");
    expect(html).toContain("Xi măng");
    expect(html).toContain("cái");
    expect(html).toContain("bao");
    expect(html).toContain(">Lưu</button>");
    expect(html).toContain("Hủy");
  });

  it("renders a set_price product-management preview with VND formatting", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "ready",
          action: "set_price",
          product: {
            id: "product-xi-mang",
            name: "Xi măng",
            unit: "bao",
            sell_price: null,
          },
          target: { sell_price: 85000 },
        },
      },
    );

    expect(html).toContain("Đặt giá bán");
    expect(html).toContain("—");
    expect(html).toContain("85.000");
    expect(html).toContain("Lưu");
  });

  it("renders product-management candidate picker without create controls", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "needs_choice",
          action: "set_unit",
          product_raw: "xi măng",
          target: { unit: "bao" },
          candidates: [
            {
              id: "product-a",
              name: "Xi măng A",
              unit: "cái",
              sell_price: null,
              score: 0.95,
              matched_on: "alias_exact",
              matched_value: "xi măng",
            },
            {
              id: "product-b",
              name: "Xi măng B",
              unit: "bao",
              sell_price: 90000,
              score: 0.95,
              matched_on: "alias_exact",
              matched_value: "xi măng",
            },
          ],
        },
      },
    );

    expect(html).toContain('data-testid="product-management-needs_choice"');
    expect(html).toContain('data-testid="product-confirm-panel"');
    expect(html).toContain("Xi măng A");
    expect(html).toContain("Xi măng B");
    expect(html).not.toContain("Thêm mặt hàng");
    expect(html).not.toContain("thêm khách");
  });

  it("renders a create_draft product-management form before the manage_product placeholder", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "create_draft",
          action: "create",
          product_raw: "gạch đỏ",
          draft: {
            name: "gạch đỏ",
            unit: "cái",
            sell_price: null,
          },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-create_draft"');
    expect(html).toContain("Thêm hàng mới");
    expect(html).toContain("Tên hàng");
    expect(html).toContain('value="gạch đỏ"');
    expect(html).toContain("Đơn vị");
    expect(html).toContain('value="cái"');
    expect(html).toContain("Giá bán");
    expect(html).toContain("bao");
    expect(html).toContain("cây");
    expect(html).toContain("m³");
    expect(html).toContain("Tạo hàng");
    expect(html).toContain("Hủy");
    expect(html).not.toContain("Tính năng quản lý hàng qua chat em đang hoàn thiện");
  });

  it("renders a create_duplicate product-management notice without create controls", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "create_duplicate",
          action: "create",
          product_raw: "gạch đỏ",
          product: {
            id: "product-gach-do",
            name: "gạch đỏ",
            unit: "viên",
            sell_price: 2000,
          },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-create-duplicate"');
    expect(html).toContain("Hàng");
    expect(html).toContain("gạch đỏ");
    expect(html).toContain("đã có trong danh sách");
    expect(html).toContain("đổi đơn vị/giá");
    expect(html).not.toContain("Tạo hàng");
    expect(html).not.toContain("Tên hàng");
    expect(html).not.toContain('value="gạch đỏ"');
    expect(html).not.toContain("Giá bán");
  });

  it("renders a created product-management success state", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "created",
          action: "create",
          product: {
            id: "product-gach-do",
            name: "gạch đỏ",
            unit: "bao",
            sell_price: 85000,
          },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-created"');
    expect(html).toContain("Đã thêm hàng gạch đỏ.");
    expect(html).toContain("Đơn vị");
    expect(html).toContain("bao");
    expect(html).toContain("Giá bán");
    expect(html).toContain("85.000");
    expect(html).not.toContain("Tạo hàng");
  });

  it("renders a confirm_delete product-management card with Ghi and Bỏ", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "confirm_delete",
          action: "delete",
          product: {
            id: "product-fff",
            name: "fff",
            unit: "cái",
            sell_price: 12000,
          },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-confirm_delete"');
    expect(html).toContain("Xác nhận xóa hàng");
    expect(html).toContain("fff");
    expect(html).toContain("cái");
    expect(html).toContain("12.000");
    expect(html).toContain(">Ghi</button>");
    expect(html).toContain(">Bỏ</button>");
    expect(html).not.toContain(">Lưu</button>");
  });

  it("renders a deleted product-management success state without controls", () => {
    const html = renderCard(
      baseValidated({
        intent: "manage_product",
        kind: "none",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        productManagementPreview: {
          status: "deleted",
          action: "delete",
          product: {
            id: "product-fff",
            name: "fff",
            unit: "cái",
            sell_price: 12000,
          },
        },
      },
    );

    expect(html).toContain('data-testid="product-management-deleted"');
    expect(html).toContain("Đã xóa hàng fff khỏi danh sách.");
    expect(html).not.toContain(">Ghi</button>");
    expect(html).not.toContain(">Bỏ</button>");
  });

  it("renders a debt answer on a query card", () => {
    const html = renderCard(
      baseValidated({
        intent: "query_debt",
        kind: "query",
        raw_text: "anh Hùng nợ bao nhiêu?",
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        answer: {
          type: "debt",
          state: "found",
          customerName: "anh Hùng",
          debt: 400000,
          lastOrderAt: "2026-05-31T08:00:00.000Z",
          lastPaymentAt: null,
        },
      },
    );

    expect(html).toContain("Câu hỏi");
    expect(html).toContain("anh Hùng đang nợ");
    expect(html).not.toContain("Anh/chị anh Hùng đang nợ");
    expect(html).toContain("400.000 đ");
    expect(html).toContain("Đơn gần nhất");
    expect(html).not.toContain("Phần trả lời sẽ có ở bước sau ạ.");
  });

  it("keeps the other debt answer copy unchanged", () => {
    const validated = baseValidated({
      intent: "query_debt",
      kind: "query",
      raw_text: "anh Hùng nợ bao nhiêu?",
      items: [],
      effective_amount: null,
      ready_for_preview: false,
    });
    const zeroHtml = renderCard(validated, {
      answer: {
        type: "debt",
        state: "found",
        customerName: "anh Hùng",
        debt: 0,
        lastOrderAt: null,
        lastPaymentAt: null,
      },
    });
    const notFoundHtml = renderCard(validated, {
      answer: {
        type: "debt",
        state: "not_found",
        askedName: "anh Phát",
      },
    });
    const ambiguousHtml = renderCard(validated, {
      answer: {
        type: "debt",
        state: "ambiguous",
        askedName: "Lan",
        candidates: ["chị Lan", "cô Lan"],
      },
    });

    expect(zeroHtml).toContain("anh Hùng không còn nợ ạ.");
    expect(notFoundHtml).toContain("Em chưa thấy khách tên");
    expect(notFoundHtml).toContain("anh Phát");
    expect(ambiguousHtml).toContain("Em chưa chắc bác hỏi ai: chị Lan, cô Lan");
    expect(ambiguousHtml).toContain("Bác nhắn rõ tên giúp em ạ.");
  });

  it("renders a sales answer on a query card", () => {
    const html = renderCard(
      baseValidated({
        intent: "query_sales",
        kind: "query",
        raw_text: "tháng này bán bao nhiêu?",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        answer: {
          type: "sales",
          state: "ok",
          rangeKind: "this_month",
          rangeLabel: "tháng này",
          from: "2026-06-01",
          to: "2026-06-17",
          orders: 2,
          revenue: 600000,
          paid: 100000,
          debt: 500000,
        },
      },
    );

    expect(html).toContain("tháng này: 2 đơn");
    expect(html).toContain("600.000 đ");
    expect(html).toContain("Đã thu 100.000 đ");
    expect(html).toContain("Nợ thêm 500.000 đ");
  });

  it("renders a positive inventory answer on a query card", () => {
    const html = renderCard(
      baseValidated({
        intent: "query_inventory",
        kind: "query",
        raw_text: "còn bao nhiêu xi măng?",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        answer: {
          type: "inventory",
          state: "found",
          productName: "xi măng",
          stock: 144,
          unit: "bao",
        },
      },
    );

    expect(html).toContain("Còn");
    expect(html).toContain("144 bao");
    expect(html).toContain("xi măng");
    expect(html).not.toContain("Phần trả lời sẽ có ở bước sau ạ.");
  });

  it("renders zero inventory as out of stock", () => {
    const html = renderCard(
      baseValidated({
        intent: "query_inventory",
        kind: "query",
        raw_text: "còn bao nhiêu xi măng?",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        answer: {
          type: "inventory",
          state: "found",
          productName: "xi măng",
          stock: 0,
          unit: "bao",
        },
      },
    );

    expect(html).toContain("xi măng hết hàng rồi ạ.");
  });

  it("renders negative inventory as oversold stock", () => {
    const html = renderCard(
      baseValidated({
        intent: "query_inventory",
        kind: "query",
        raw_text: "còn bao nhiêu xi măng?",
        customer: null,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
      {
        answer: {
          type: "inventory",
          state: "found",
          productName: "xi măng",
          stock: -3.5,
          unit: "bao",
        },
      },
    );

    expect(html).toContain("xi măng đang âm 3,5 bao");
    expect(html).toContain("(đã bán quá tồn) ạ.");
  });

  it("renders inventory not_found and ambiguous answers", () => {
    const validated = baseValidated({
      intent: "query_inventory",
      kind: "query",
      raw_text: "còn bao nhiêu xi?",
      customer: null,
      items: [],
      effective_amount: null,
      ready_for_preview: false,
    });
    const notFoundHtml = renderCard(validated, {
      answer: {
        type: "inventory",
        state: "not_found",
        askedName: "ngói",
      },
    });
    const ambiguousHtml = renderCard(validated, {
      answer: {
        type: "inventory",
        state: "ambiguous",
        askedName: "xi",
        candidates: ["xi măng", "xi trắng"],
      },
    });

    expect(notFoundHtml).toContain("Em chưa thấy hàng");
    expect(notFoundHtml).toContain("ngói");
    expect(ambiguousHtml).toContain("Em chưa chắc bác hỏi hàng nào: xi măng, xi trắng");
    expect(ambiguousHtml).toContain("Bác nói rõ tên giúp em ạ.");
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
    expect(purchaseHtml).toContain("Đơn vị");
    expect(purchaseHtml).toContain("Ghi nhập hàng");
    expect(purchaseHtml).toContain(">Bỏ</button>");
    expect(paymentHtml).toContain("Thu / trả nợ");
    expect(paymentHtml).toContain("500.000 đ");
    expect(paymentHtml).not.toContain("Đơn vị");
    expect(paymentHtml).toContain("Ghi thu nợ");
    expect(paymentHtml).toContain(">Bỏ</button>");
  });

  it("shows an unsettled total (—) for a payment with no amount yet", () => {
    const html = renderCard(
      baseValidated({
        intent: "record_payment",
        customer: resolvedCustomer,
        items: [],
        effective_amount: null,
        ready_for_preview: false,
      }),
    );

    // Header "Tổng tiền" shows the unsettled dash instead of a misleading number.
    expect(html).toContain("Thu / trả nợ");
    expect(html).toContain("—");
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

  it("offers supplier search on a supplierless purchase card", () => {
    const html = renderCard(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: null,
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
      }),
    );

    expect(html).toContain("Đơn nhập hàng");
    expect(html).toContain("Tìm nhà cung cấp");
    expect(html).toContain("Ghi nhập hàng");
    expect(html).not.toContain('disabled=""');
  });

  it("renders supplier candidate choices and create-new choice for unresolved supplier", () => {
    const html = renderCard(
      baseValidated({
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
            code: "supplier_unresolved",
            severity: "blocking",
            message: 'Có vài nhà cung cấp gần giống "Song Hong", cần chọn đúng.',
            field_path: "supplier",
            item_index: null,
          },
        ],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain('data-testid="supplier-confirm-panel"');
    expect(html).toContain("Sông Hồng");
    expect(html).toContain("Không phải, thêm nhà cung cấp mới");
    expect(html).not.toContain("thêm khách mới");
  });

  it("renders create supplier panel for not_found supplier", () => {
    const html = renderCard(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: {
          raw: "Minh Phát",
          entity_type: "supplier",
          status: "not_found",
          resolved_id: null,
          resolved_name: null,
          confidence: 0,
          candidates: [],
        },
        issues: [
          {
            code: "supplier_unresolved",
            severity: "blocking",
            message: 'Không tìm thấy nhà cung cấp "Minh Phát".',
            field_path: "supplier",
            item_index: null,
          },
        ],
        ready_for_preview: false,
        blocking_count: 1,
      }),
    );

    expect(html).toContain('data-testid="supplier-create-panel"');
    expect(html).toContain("Chưa có nhà cung cấp");
    expect(html).toContain("Minh Phát");
  });

  it("renders inline product creation with order unit and sell-price prefill", () => {
    const html = renderCard(
      baseValidated({
        items: [
          item({
            product_name: "xi măng",
            quantity: 10,
            unit: "bao",
            unit_price: 85000,
            effective_quantity: 10,
            effective_unit: "bao",
            effective_unit_price: 85000,
            line_total: 850000,
            resolution: {
              raw: "xi măng",
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

    expect(html).toContain('data-testid="product-create-panel"');
    expect(html).toContain("Chưa có mặt hàng");
    expect(html).toContain('value="bao"');
    expect(html).toContain('value="85000"');
    expect(html).toContain("Tạo hàng");
    expect(html).toContain('disabled=""');
  });

  it("renders inline product creation for purchase without copying purchase price", () => {
    const html = renderCard(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: resolvedSupplier,
        items: [
          item({
            product_name: "xi măng",
            quantity: 100,
            unit: "bao",
            unit_price: 70000,
            effective_quantity: 100,
            effective_unit: "bao",
            effective_unit_price: 70000,
            line_total: 7000000,
            resolution: {
              raw: "xi măng",
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
    const panelHtml = renderToStaticMarkup(
      createElement(ProductCreatePanel, {
        raw: "xi măng",
        defaultUnit: "bao",
        defaultSellPrice: null,
        isSaving: false,
        error: null,
        onCreate: () => undefined,
        onDismiss: () => undefined,
        onDraftChange: () => undefined,
      }),
    );

    expect(html).toContain('data-testid="product-create-panel"');
    expect(panelHtml).toContain('value="bao"');
    expect(panelHtml).toContain('value=""');
    expect(panelHtml).not.toContain('value="70000"');
  });

  it("keeps the row unresolved and shows its panel error when inline create fails", async () => {
    const validated = baseValidated({
      items: [
        item({
          product_name: "xi măng",
          resolution: {
            raw: "xi măng",
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
    });
    const patch = createEmptyPreviewCardPatch();
    const createAction = vi.fn(async () => ({
      ok: false as const,
      code: "db_error" as const,
      message: "server detail",
    }));
    const result = await createProductPatchForItem(
      {
        patch,
        itemIndex: 0,
        rawName: "xi măng",
        draft: { unit: "bao", sell_price: 85000 },
      },
      createAction,
    );

    expect(result).toEqual({
      ok: false,
      message: "Chưa thêm được mặt hàng, bác thử lại ạ.",
    });
    if (result.ok) {
      throw new Error("Expected inline product creation to fail");
    }
    const panelHtml = renderToStaticMarkup(
      createElement(ProductCreatePanel, {
        raw: "xi măng",
        defaultUnit: "bao",
        defaultSellPrice: 85000,
        isSaving: false,
        error: result.message,
        onCreate: () => undefined,
        onDismiss: () => undefined,
        onDraftChange: () => undefined,
      }),
    );
    const state = getPatchedPreviewState(validated, patch);

    expect(panelHtml).toContain("xi măng");
    expect(panelHtml).toContain("Chưa thêm được mặt hàng, bác thử lại ạ.");
    expect(state.items[0].resolution.status).toBe("not_found");
    expect(state.items[0].resolution.resolved_id).toBeNull();
    expect(state.canConfirm).toBe(false);
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
    expect(html).not.toContain(">Bỏ</button>");
  });
});
