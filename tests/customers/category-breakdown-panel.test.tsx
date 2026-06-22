import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryBreakdownPanel } from "@/src/components/customers/category-breakdown-panel";
import {
  UNCLASSIFIED_LABEL,
  type CategoryBreakdown,
} from "@/src/lib/customers/category-breakdown";

function render(breakdown: CategoryBreakdown) {
  return renderToStaticMarkup(
    createElement(CategoryBreakdownPanel, { breakdown }),
  );
}

describe("CategoryBreakdownPanel (DC-5a)", () => {
  it("hiện từng nhóm + panel đối chiếu cộng khớp 'Còn nợ'", () => {
    const html = render({
      groups: [
        { name: "Cát", purchased: 500_000, deposited: 0, tentative: 500_000 },
        {
          name: "Xi măng",
          purchased: 1_000_000,
          deposited: 300_000,
          tentative: 700_000,
        },
        {
          name: UNCLASSIFIED_LABEL,
          purchased: 200_000,
          deposited: 0,
          tentative: 200_000,
        },
      ],
      generalDeposit: 100_000,
      paidImmediate: 0,
      groupTentativeTotal: 1_400_000,
      remainder: 1_300_000,
      debtTotal: 1_300_000,
      reconciles: true,
    });

    expect(html).toContain("Xi măng");
    expect(html).toContain("Cát");
    expect(html).toContain(UNCLASSIFIED_LABEL);
    expect(html).toContain("Σ Tạm tính các nhóm");
    expect(html).toContain("− Cọc chung");
    expect(html).toContain("100.000 đ");
    expect(html).toContain("= Còn nợ");
    expect(html).toContain("1.300.000 đ");
    expect(html).toContain("Tạm tính theo nhóm chỉ để tham khảo");
    // Không có trả ngay → không hiện dòng đó.
    expect(html).not.toContain("− Trả ngay khi mua");
  });

  it("nhóm cọc dư hiển thị 'Cọc dư' tone paid, panel 'Khách trả trước'", () => {
    const html = render({
      groups: [
        { name: "Sơn", purchased: 0, deposited: 200_000, tentative: -200_000 },
      ],
      generalDeposit: 0,
      paidImmediate: 0,
      groupTentativeTotal: -200_000,
      remainder: -200_000,
      debtTotal: -200_000,
      reconciles: true,
    });

    expect(html).toContain("Cọc dư");
    expect(html).toContain("200.000 đ");
    expect(html).toContain("text-paid");
    // Dòng standing cuối dùng reconciliationFinalLine → credit dương, KHÔNG âm.
    expect(html).toContain("= Khách trả trước");
    expect(html).not.toContain('text-debt">= ');
  });

  it("hiện dòng 'Trả ngay khi mua' khi paidImmediate > 0", () => {
    const html = render({
      groups: [
        {
          name: "Xi măng",
          purchased: 1_000_000,
          deposited: 200_000,
          tentative: 800_000,
        },
      ],
      generalDeposit: 0,
      paidImmediate: 300_000,
      groupTentativeTotal: 800_000,
      remainder: 500_000,
      debtTotal: 500_000,
      reconciles: true,
    });

    expect(html).toContain("− Trả ngay khi mua");
    expect(html).toContain("300.000 đ");
    expect(html).not.toContain("− Cọc chung");
  });
});
