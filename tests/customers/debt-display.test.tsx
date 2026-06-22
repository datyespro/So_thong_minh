import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DebtHeadline,
  DebtValue,
} from "@/src/components/customers/debt-display";

describe("DebtValue (danh sách khách — VĐ3 nợ âm)", () => {
  it("shows prepaid credit, not a raw negative number", () => {
    const html = renderToStaticMarkup(createElement(DebtValue, { value: -77_416_000 }));
    expect(html).toContain("Trả trước");
    expect(html).toContain("77.416.000 đ");
    expect(html).toContain("text-paid");
    expect(html).not.toContain("-77");
    expect(html).not.toContain("−77");
  });

  it("keeps an outstanding debt as a red amount", () => {
    const html = renderToStaticMarkup(createElement(DebtValue, { value: 600_000 }));
    expect(html).toContain("600.000 đ");
    expect(html).toContain("text-debt");
    expect(html).not.toContain("Trả trước");
  });
});

describe("DebtHeadline (trang khách — VĐ3 nợ âm)", () => {
  it("labels a negative balance as prepaid credit", () => {
    const html = renderToStaticMarkup(
      createElement(DebtHeadline, { debtTotal: -77_416_000 }),
    );
    expect(html).toContain("Khách trả trước");
    expect(html).toContain("77.416.000 đ");
    expect(html).toContain("text-paid");
    expect(html).not.toContain("Số nợ hiện tại");
    expect(html).not.toContain("-77");
  });

  it("keeps the outstanding-debt headline for a positive balance", () => {
    const html = renderToStaticMarkup(
      createElement(DebtHeadline, { debtTotal: 600_000 }),
    );
    expect(html).toContain("Số nợ hiện tại");
    expect(html).toContain("600.000 đ");
    expect(html).not.toContain("Khách trả trước");
  });
});
