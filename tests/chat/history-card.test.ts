import { describe, expect, it } from "vitest";
import {
  historyCustomerCardContent,
  historyProductCardContent,
  parseHistoryCommitCard,
  parseHistoryCustomerCard,
  parseHistoryProductCard,
} from "@/src/lib/chat/history-card";

const validCard = {
  v: 1,
  kind: "create_order",
  entity_name: "anh Hùng",
  business_date: "2026-06-02",
  total_amount: 300000,
  debt_amount: 300000,
  amount: null,
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

describe("parseHistoryCommitCard", () => {
  it("parses a valid v1 card from metadata", () => {
    expect(parseHistoryCommitCard({ card: validCard })).toEqual(validCard);
  });

  it("returns null when a required field is missing", () => {
    const missingSourceId: Record<string, unknown> = { ...validCard };
    delete missingSourceId.source_id;

    expect(parseHistoryCommitCard({ card: missingSourceId })).toBeNull();
  });

  it("accepts a present null source_id for an uncommitted preview", () => {
    expect(
      parseHistoryCommitCard({ card: { ...validCard, source_id: null } }),
    ).toEqual({ ...validCard, source_id: null });
  });

  it("rejects an undefined source_id", () => {
    expect(
      parseHistoryCommitCard({ card: { ...validCard, source_id: undefined } }),
    ).toBeNull();
  });

  it("returns null for the wrong version", () => {
    expect(parseHistoryCommitCard({ card: { ...validCard, v: 2 } })).toBeNull();
  });

  it("returns null for garbage metadata", () => {
    expect(parseHistoryCommitCard("not-json")).toBeNull();
    expect(parseHistoryCommitCard({ card: "not-a-card" })).toBeNull();
  });
});

describe("parseHistoryProductCard", () => {
  const productCard = {
    v: 1,
    kind: "manage_product",
    action: "delete",
    status: "deleted",
    product_name: "fff",
    product_raw: null,
    unit: "m³",
    sell_price: null,
  } as const;

  it("parses a valid product result card", () => {
    expect(parseHistoryProductCard({ card: productCard })).toEqual(productCard);
  });

  it("returns null for malformed product cards", () => {
    expect(
      parseHistoryProductCard({ card: { ...productCard, status: "ready" } }),
    ).toBeNull();
    expect(
      parseHistoryProductCard({ card: { ...productCard, kind: "create_order" } }),
    ).toBeNull();
    expect(parseHistoryProductCard({ card: null })).toBeNull();
  });

  it("builds canonical persisted content for product terminal states", () => {
    expect(historyProductCardContent(productCard)).toBe(
      "Đã xóa hàng fff khỏi danh sách.",
    );
    expect(
      historyProductCardContent({
        ...productCard,
        action: "create",
        status: "create_duplicate",
        product_name: "xi măng",
        unit: "bao",
        sell_price: 100000,
      }),
    ).toBe("Hàng 'xi măng' đã có trong danh sách.");
    expect(
      historyProductCardContent({
        ...productCard,
        action: "set_unit",
        status: "dismissed",
        product_name: "xi măng",
      }),
    ).toBe("Đã bỏ, chưa lưu vào danh sách.");
  });
});

describe("parseHistoryCustomerCard", () => {
  const customerCard = {
    v: 1,
    kind: "manage_customer",
    action: "rename",
    status: "renamed",
    customer_name: "chị Lan",
    customer_raw: null,
    new_name: "Lan xóm Nghè",
  } as const;

  it("parses a valid customer result card", () => {
    expect(parseHistoryCustomerCard({ card: customerCard })).toEqual(
      customerCard,
    );
  });

  it("returns null for malformed customer cards", () => {
    expect(
      parseHistoryCustomerCard({
        card: { ...customerCard, status: "confirm_rename" },
      }),
    ).toBeNull();
    expect(
      parseHistoryCustomerCard({ card: { ...customerCard, kind: "manage_product" } }),
    ).toBeNull();
    expect(parseHistoryCustomerCard({ card: null })).toBeNull();
  });

  it("builds canonical persisted content for customer terminal states", () => {
    expect(historyCustomerCardContent(customerCard)).toBe(
      "Đã đổi tên khách chị Lan thành Lan xóm Nghè.",
    );
    expect(
      historyCustomerCardContent({
        ...customerCard,
        status: "not_found",
        customer_name: null,
        customer_raw: "chị lan",
      }),
    ).toBe("Không tìm thấy khách tên chị lan ạ.");
    expect(
      historyCustomerCardContent({
        ...customerCard,
        status: "dismissed",
      }),
    ).toBe("Đã bỏ, chưa đổi tên khách.");
  });
});
