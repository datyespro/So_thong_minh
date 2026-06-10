import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoryCommitCard } from "@/src/components/chat/history-commit-card";
import {
  buildDismissedPreviewCardFromState,
  claimDismissPreview,
  isDuplicateDismissedPreviewMessage,
} from "@/src/components/chat/preview-card/dismissed-preview-card";
import { getPatchedPreviewState } from "@/src/components/chat/preview-card/preview-state";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import type { ChatMessageView } from "@/src/components/chat/types";
import {
  parseHistoryCommitCard,
  type HistoryCommitCard as HistoryCommitCardData,
} from "@/src/lib/chat/history-card";
import {
  baseValidated,
  item,
  missingCustomer,
  resolvedSupplier,
} from "@/tests/chat/preview-card-fixtures";

describe("buildDismissedPreviewCardFromState", () => {
  it("copies the displayed order totals and items without a source id", () => {
    const state = getPatchedPreviewState(
      baseValidated(),
      createEmptyPreviewCardPatch(),
    );

    expect(
      buildDismissedPreviewCardFromState(
        state,
        "create_order",
        "2026-06-10",
      ),
    ).toEqual({
      v: 1,
      kind: "create_order",
      entity_name: "anh Hùng",
      business_date: "2026-06-10",
      total_amount: 1600000,
      debt_amount: null,
      amount: null,
      items: [
        {
          name: "xi măng",
          quantity: 20,
          unit: "bao",
          unit_price: 80000,
          line_total: 1600000,
        },
      ],
      source_id: null,
    });
  });

  it("builds a payment card with amount and null items", () => {
    const state = getPatchedPreviewState(
      baseValidated({
        intent: "record_payment",
        items: [],
        effective_amount: 500000,
      }),
      createEmptyPreviewCardPatch(),
    );
    const card = buildDismissedPreviewCardFromState(
      state,
      "record_payment",
      "2026-06-10",
    );

    expect(card).toMatchObject({
      kind: "record_payment",
      entity_name: "anh Hùng",
      business_date: null,
      total_amount: null,
      debt_amount: null,
      amount: 500000,
      items: null,
      source_id: null,
    });
  });

  it("maps the displayed purchase unit cost into card unit_price", () => {
    const state = getPatchedPreviewState(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: resolvedSupplier,
        items: [
          item({
            unit_price: 70000,
            effective_unit_price: 70000,
            line_total: 1400000,
          }),
        ],
      }),
      createEmptyPreviewCardPatch(),
    );
    const card = buildDismissedPreviewCardFromState(
      state,
      "create_purchase",
      "2026-06-10",
    );

    expect(card).toMatchObject({
      kind: "create_purchase",
      entity_name: "Nhà cung cấp A",
      total_amount: 1400000,
      debt_amount: null,
      amount: null,
      source_id: null,
    });
    expect(card?.items?.[0]).toMatchObject({
      unit_price: 70000,
      line_total: 1400000,
    });
  });

  it("keeps an unresolved entity null and builds an incomplete purchase card", () => {
    const unresolvedState = getPatchedPreviewState(
      baseValidated({ customer: missingCustomer }),
      createEmptyPreviewCardPatch(),
    );
    const invalidItemState = getPatchedPreviewState(
      baseValidated({
        intent: "create_purchase",
        customer: null,
        supplier: resolvedSupplier,
        items: [
          item({
            unit_price: null,
            effective_unit_price: null,
            line_total: null,
          }),
        ],
      }),
      createEmptyPreviewCardPatch(),
    );

    expect(
      buildDismissedPreviewCardFromState(
        unresolvedState,
        "create_order",
        "2026-06-10",
      )?.entity_name,
    ).toBeNull();
    expect(
      buildDismissedPreviewCardFromState(
        invalidItemState,
        "create_purchase",
        "2026-06-10",
      ),
    ).toMatchObject({
      kind: "create_purchase",
      entity_name: "Nhà cung cấp A",
      total_amount: 0,
      items: [
        {
          name: "xi măng",
          quantity: 20,
          unit: "bao",
          unit_price: null,
          line_total: null,
        },
      ],
      source_id: null,
    });
  });

  it("builds a payment card when the amount is missing", () => {
    const state = getPatchedPreviewState(
      baseValidated({
        intent: "record_payment",
        items: [],
        effective_amount: null,
      }),
      createEmptyPreviewCardPatch(),
    );

    expect(
      buildDismissedPreviewCardFromState(
        state,
        "record_payment",
        "2026-06-10",
      ),
    ).toMatchObject({
      kind: "record_payment",
      amount: null,
      items: null,
      source_id: null,
    });
  });

  it("coerces non-finite displayed numbers to null", () => {
    const state = getPatchedPreviewState(
      baseValidated(),
      createEmptyPreviewCardPatch(),
    );
    const card = buildDismissedPreviewCardFromState(
      {
        ...state,
        total: Number.POSITIVE_INFINITY,
        items: [
          {
            ...state.items[0],
            quantity: Number.NaN,
            unitPrice: Number.POSITIVE_INFINITY,
            lineTotal: Number.NEGATIVE_INFINITY,
          },
        ],
      },
      "create_order",
      "2026-06-10",
    );

    expect(card.total_amount).toBeNull();
    expect(card.items?.[0]).toMatchObject({
      quantity: null,
      unit_price: null,
      line_total: null,
    });
  });
});

describe("incomplete dismissed history cards", () => {
  const incompleteCard: HistoryCommitCardData = {
    v: 1,
    kind: "create_purchase",
    entity_name: "Đại lý Minh Phát",
    business_date: "2026-06-10",
    total_amount: null,
    debt_amount: null,
    amount: null,
    items: [
      {
        name: "xi măng",
        quantity: null,
        unit: "bao",
        unit_price: null,
        line_total: null,
      },
    ],
    source_id: null,
  };

  it("parses null item numbers but still rejects a missing item key", () => {
    expect(parseHistoryCommitCard({ card: incompleteCard })).toEqual(
      incompleteCard,
    );

    const itemMissingUnitPrice: Record<string, unknown> = {
      ...incompleteCard.items?.[0],
    };
    delete itemMissingUnitPrice.unit_price;

    expect(
      parseHistoryCommitCard({
        card: { ...incompleteCard, items: [itemMissingUnitPrice] },
      }),
    ).toBeNull();
  });

  it("renders missing quantity and money as dashes", () => {
    const html = renderToStaticMarkup(
      createElement(HistoryCommitCard, {
        card: incompleteCard,
        confirmationText: "Đã bỏ nhập hàng từ Đại lý Minh Phát",
        confirmationTone: "dismissed",
      }),
    );

    expect(html).toContain("Đơn nhập hàng");
    expect(html).toContain("Đại lý Minh Phát");
    expect(html).toContain("xi măng");
    expect(html.match(/—/g) ?? []).toHaveLength(4);
    expect(html).not.toContain("Chưa có");
  });

  it("keeps a complete #21 card committed, green, checked, and fully numbered", () => {
    const completeCard: HistoryCommitCardData = {
      ...incompleteCard,
      kind: "create_order",
      entity_name: "anh Hùng",
      total_amount: 300000,
      debt_amount: 300000,
      items: [
        {
          name: "xi măng",
          quantity: 3,
          unit: "bao",
          unit_price: 100000,
          line_total: 300000,
        },
      ],
      source_id: "order-1",
    };
    const html = renderToStaticMarkup(
      createElement(HistoryCommitCard, {
        card: completeCard,
        confirmationText: "Đã ghi đơn cho anh Hùng",
      }),
    );

    expect(html).toContain("lucide-check");
    expect(html).toContain("text-paid");
    expect(html).toContain("300.000 đ");
    expect(html).toContain("100.000 đ");
    expect(html).toContain("3");
  });
});

describe("dismiss preview guards", () => {
  it("claims a dismiss ref only once", () => {
    const ref = { current: false };

    expect(claimDismissPreview(ref)).toBe(true);
    expect(claimDismissPreview(ref)).toBe(false);
  });

  it("deduplicates the restored ephemeral dismissed message", () => {
    const payload = {
      content: "Đã bỏ đơn của Ngọc Anh",
      card: null,
    };
    const messages: ChatMessageView[] = [
      {
        id: "dismiss-1",
        role: "assistant",
        content: payload.content,
        created_at: "2026-06-10T10:00:00.000Z",
        metadata: { source: "tip_22_dismiss", card: null },
        ephemeral: true,
      },
    ];

    expect(isDuplicateDismissedPreviewMessage(messages, payload)).toBe(true);
  });
});
