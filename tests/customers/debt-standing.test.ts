import { describe, expect, it } from "vitest";
import {
  debtStanding,
  debtStandingSentence,
  reconciliationFinalLine,
  reconciliationPrintFinalLine,
} from "@/src/lib/customers/debt-standing";

describe("debtStanding (VĐ3 — nguồn quyết định dấu duy nhất)", () => {
  it("treats a positive total as an outstanding debt", () => {
    expect(debtStanding(600_000)).toEqual({ kind: "debt", amount: 600_000 });
  });

  it("treats a negative total as customer credit (we owe them) with a positive amount", () => {
    expect(debtStanding(-77_416_000)).toEqual({
      kind: "credit",
      amount: 77_416_000,
    });
  });

  it("treats zero as settled", () => {
    expect(debtStanding(0)).toEqual({ kind: "settled" });
  });
});

describe("debtStandingSentence", () => {
  it("phrases an outstanding debt", () => {
    expect(debtStandingSentence("chị Lan", 600_000)).toBe(
      "chị Lan đang nợ 600.000 đ",
    );
  });

  it("phrases customer credit instead of saying the debt is cleared", () => {
    expect(debtStandingSentence("chị Lan", -77_416_000)).toBe(
      "chị Lan đã trả trước 77.416.000 đ (mình đang nợ lại khách) ạ.",
    );
  });

  it("phrases a settled balance", () => {
    expect(debtStandingSentence("chị Lan", 0)).toBe("chị Lan không còn nợ ạ.");
  });
});

describe("reconciliationFinalLine (dòng cuối khối đối chiếu khách)", () => {
  it("keeps an outstanding debt as 'Còn nợ'", () => {
    expect(reconciliationFinalLine(600_000)).toEqual({
      label: "Còn nợ",
      amount: 600_000,
      tone: "debt",
    });
  });

  it("keeps a settled balance as 'Còn nợ 0'", () => {
    expect(reconciliationFinalLine(0)).toEqual({
      label: "Còn nợ",
      amount: 0,
      tone: "debt",
    });
  });

  it("flips a negative balance to 'Khách trả trước' with a positive amount", () => {
    expect(reconciliationFinalLine(-77_416_000)).toEqual({
      label: "Khách trả trước",
      amount: 77_416_000,
      tone: "credit",
    });
  });
});

describe("reconciliationPrintFinalLine (dòng tổng cuối của BẢN IN đối chiếu)", () => {
  it("keeps an outstanding debt as '= Còn nợ cuối kỳ' with no credit note", () => {
    const line = reconciliationPrintFinalLine(5_000_000);
    expect(line.label).toBe("= Còn nợ cuối kỳ");
    expect(line.amount).toBe(5_000_000);
    expect(line.note).toBeUndefined();
    expect(line.words).not.toContain("Âm");
    expect(line.words.toLowerCase()).not.toContain("âm");
  });

  it("keeps a settled balance as '= Còn nợ cuối kỳ' / 0 đồng, no note", () => {
    const line = reconciliationPrintFinalLine(0);
    expect(line.label).toBe("= Còn nợ cuối kỳ");
    expect(line.amount).toBe(0);
    expect(line.words).toBe("Không đồng.");
    expect(line.note).toBeUndefined();
  });

  it("flips a negative balance to '= Khách trả trước' with a positive amount, words and note (no 'Âm')", () => {
    const line = reconciliationPrintFinalLine(-86_090_000);
    expect(line.label).toBe("= Khách trả trước");
    expect(line.amount).toBe(86_090_000);
    expect(line.words).toBe(
      "Tám mươi sáu triệu không trăm chín mươi nghìn đồng chẵn.",
    );
    expect(line.words.toLowerCase()).not.toContain("âm");
    expect(line.note).toBe(
      "Cửa hàng đang giữ trước của khách 86.090.000 đ, sẽ trừ vào đơn sau.",
    );
  });
});
