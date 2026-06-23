import { describe, expect, it } from "vitest";
import { pickPageCuts } from "@/src/lib/invoice/export-pdf";

describe("pickPageCuts — cắt trang theo mép DÒNG (FIX-3)", () => {
  it("chọn mép dòng lớn nhất ≤ trang (không cắt giữa dòng)", () => {
    // boundaries là đáy các dòng; cắt phải rơi đúng đáy dòng, không phải 300/550 giữa dòng.
    expect(pickPageCuts([100, 250, 400, 550], 600, 300)).toEqual([250, 550]);
  });

  it("fallback cắt cứng mỗi pageSlicePx khi không có mép trong tầm", () => {
    expect(pickPageCuts([], 700, 300)).toEqual([300, 600]);
  });

  it("tài liệu ≤ 1 trang → không cắt", () => {
    expect(pickPageCuts([100], 250, 300)).toEqual([]);
  });

  it("biên: totalHeight == pageSlicePx → không cắt", () => {
    expect(pickPageCuts([150], 300, 300)).toEqual([]);
  });

  it("tiến trình khi 1 dòng cao hơn trang (boundary 500 > slice 300)", () => {
    const cuts = pickPageCuts([500], 900, 300);
    // trang đầu không có mép trong (0,300] → cắt cứng 300; rồi 500 (mép), rồi cứng 800.
    expect(cuts).toEqual([300, 500, 800]);
    // mỗi cut tăng dần (không kẹt vòng lặp).
    for (let i = 1; i < cuts.length; i++) {
      expect(cuts[i]).toBeGreaterThan(cuts[i - 1]);
    }
  });

  it("bỏ qua boundary ngoài (startY, ideal]; ưu tiên mép gần đáy trang nhất", () => {
    // boundaries gồm cả mép quá nhỏ (50) và mép quá lớn (chỉ xét ≤ ideal).
    // trang1 (0,400]: max trong tầm = 380; trang2 (380,780]: max = 760.
    expect(pickPageCuts([50, 380, 760, 900], 1000, 400)).toEqual([380, 760]);
  });
});
