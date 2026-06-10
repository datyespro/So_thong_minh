import { describe, expect, it } from "vitest";
import { parseHistoryCommitCard } from "@/src/lib/chat/history-card";

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

  it("returns null for the wrong version", () => {
    expect(parseHistoryCommitCard({ card: { ...validCard, v: 2 } })).toBeNull();
  });

  it("returns null for garbage metadata", () => {
    expect(parseHistoryCommitCard("not-json")).toBeNull();
    expect(parseHistoryCommitCard({ card: "not-a-card" })).toBeNull();
  });
});
