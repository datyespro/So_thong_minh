import { describe, expect, it } from "vitest";
import {
  capabilityReply,
  detectCapabilityQuestion,
  parseCapabilityChips,
} from "@/src/lib/ai/capability-help";

describe("capability help", () => {
  it("detects general capability questions with accents and without accents", () => {
    expect(detectCapabilityQuestion("em làm được gì")).toBe("general");
    expect(detectCapabilityQuestion("lam duoc gi")).toBe("general");
  });

  it("prioritizes concrete how-to questions before general help", () => {
    expect(detectCapabilityQuestion("ghi đơn thế nào")).toBe("how_order");
    expect(detectCapabilityQuestion("thu no kieu gi")).toBe("how_payment");
    expect(detectCapabilityQuestion("nhập hàng thế nào")).toBe("how_purchase");
  });

  it("returns approved content and chip counts", () => {
    expect(capabilityReply("general").chips).toHaveLength(6);
    expect(capabilityReply("how_order").chips).toEqual([
      "Bán cho anh Hùng 5 bao xi măng 90k",
    ]);
  });

  it("parses chips metadata safely", () => {
    expect(parseCapabilityChips({ chips: ["Anh Hùng trả 200k"] })).toEqual([
      "Anh Hùng trả 200k",
    ]);
    expect(parseCapabilityChips({ chips: [] })).toBeNull();
    expect(parseCapabilityChips({ chips: ["x".repeat(121)] })).toBeNull();
    expect(parseCapabilityChips("bad")).toBeNull();
  });
});
