import { describe, expect, it } from "vitest";
import { findSafeCutY } from "@/src/lib/invoice/export-pdf";

describe("findSafeCutY — mép cắt an toàn cho phân trang PDF (FIX-2)", () => {
  it("lùi về scanline trắng đầu tiên gặp khi dò ngược", () => {
    // trắng tại y=180; còn lại trong [150..200] đều có mực.
    const isRowBlank = (y: number) => y === 180;
    expect(findSafeCutY(isRowBlank, 200, 150)).toBe(180);
  });

  it("không có scanline trắng → cắt cứng tại idealCut (fallback)", () => {
    const isRowBlank = () => false;
    expect(findSafeCutY(isRowBlank, 200, 150)).toBe(200);
  });

  it("kết quả luôn nằm trong [minCut..idealCut]", () => {
    // mọi dòng đều trắng → trả ngay idealCut (không vượt biên trên).
    const allBlank = () => true;
    expect(findSafeCutY(allBlank, 200, 160)).toBe(200);

    // chỉ trắng ở đúng biên dưới minCut.
    const blankAtMin = (y: number) => y === 160;
    const result = findSafeCutY(blankAtMin, 200, 160);
    expect(result).toBe(160);
    expect(result).toBeGreaterThanOrEqual(160);
    expect(result).toBeLessThanOrEqual(200);
  });

  it("idealCut == minCut → chỉ xét đúng 1 dòng", () => {
    expect(findSafeCutY(() => true, 200, 200)).toBe(200); // dòng đó trắng
    expect(findSafeCutY(() => false, 200, 200)).toBe(200); // không trắng → fallback
  });

  it("ưu tiên scanline trắng GẦN idealCut nhất (cắt sát mép trang)", () => {
    // trắng tại 170 và 190 — phải lấy 190 (gần idealCut 200 hơn).
    const isRowBlank = (y: number) => y === 170 || y === 190;
    expect(findSafeCutY(isRowBlank, 200, 150)).toBe(190);
  });
});
