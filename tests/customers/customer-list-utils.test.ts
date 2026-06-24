import { describe, expect, it } from "vitest";
import {
  applyUpdatedCustomer,
  customerDeleteWarning,
  formatCustomerPhone,
  removeCustomerById,
  type CustomerRow,
} from "@/app/(app)/customers/customer-list-utils";
import { formatVietnameseMoney } from "@/src/lib/format/money";

function row(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "customer-a",
    name: "anh Tư",
    phone: null,
    debt_total: 0,
    ...overrides,
  };
}

describe("formatCustomerPhone", () => {
  it("returns the trimmed phone when present", () => {
    expect(formatCustomerPhone("  0901234567  ")).toBe("0901234567");
  });

  it("returns an em dash for null or blank phone", () => {
    expect(formatCustomerPhone(null)).toBe("—");
    expect(formatCustomerPhone("   ")).toBe("—");
  });
});

describe("removeCustomerById", () => {
  it("drops only the matching customer", () => {
    const list = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const next = removeCustomerById(list, "b");
    expect(next.map((c) => c.id)).toEqual(["a", "c"]);
  });
});

describe("applyUpdatedCustomer", () => {
  it("updates name and phone for one customer and keeps debt_total", () => {
    const list = [
      row({ id: "a", name: "anh Tư", phone: null, debt_total: 50000 }),
      row({ id: "b", name: "chị Lan" }),
    ];

    const next = applyUpdatedCustomer(list, {
      id: "a",
      name: "anh Tư Lớn",
      phone: "0901234567",
    });

    expect(next[0]).toEqual({
      id: "a",
      name: "anh Tư Lớn",
      phone: "0901234567",
      debt_total: 50000,
    });
    expect(next[1]).toBe(list[1]);
  });
});

describe("customerDeleteWarning", () => {
  it("warns when the customer still owes money", () => {
    const warning = customerDeleteWarning(86090000);
    expect(warning).toEqual({
      tone: "debt",
      message: `Khách còn nợ ${formatVietnameseMoney(86090000)}. Vẫn xóa?`,
    });
  });

  it("warns (credit) when the customer paid in advance", () => {
    const warning = customerDeleteWarning(-50000);
    expect(warning).toEqual({
      tone: "credit",
      message: `Khách đang trả trước ${formatVietnameseMoney(50000)}. Vẫn xóa?`,
    });
  });

  it("returns null when settled (zero)", () => {
    expect(customerDeleteWarning(0)).toBeNull();
    expect(customerDeleteWarning(null)).toBeNull();
  });

  it("coerces string debt_total", () => {
    const warning = customerDeleteWarning("120000");
    expect(warning?.tone).toBe("debt");
  });
});
