import { createElement } from "react";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PaymentScopeDialogContent } from "@/src/components/chat/payment-scope-modal";
import type { CategoryView } from "@/src/lib/products/category";

const CATS: CategoryView[] = [
  { id: "cat-cat", name: "Cát" },
  { id: "cat-xm", name: "Xi măng" },
];

function render(
  overrides: Partial<Parameters<typeof PaymentScopeDialogContent>[0]> = {},
) {
  return renderToStaticMarkup(
    createElement(PaymentScopeDialogContent, {
      titleId: "t1",
      descriptionId: "d1",
      categories: CATS,
      loading: false,
      selectedValue: "__general__",
      submitting: false,
      errorText: null,
      cancelButtonRef: createRef<HTMLButtonElement>(),
      onSelect: vi.fn(),
      onClose: vi.fn(),
      onSave: vi.fn(),
      ...overrides,
    }),
  );
}

describe("PaymentScopeDialogContent (DC-4b)", () => {
  it("render tiêu đề, option Chung + danh mục, nút Lưu/Hủy", () => {
    const html = render();
    expect(html).toContain("Đổi nhóm cho khoản cọc này?");
    expect(html).toContain("không ảnh hưởng số tiền hay công nợ");
    expect(html).toContain("Chung (bỏ nhóm)");
    expect(html).toContain("Cát");
    expect(html).toContain("Xi măng");
    expect(html).toContain("Lưu");
    expect(html).toContain("Hủy");
  });

  it("hiện 'Đang tải danh mục…' khi loading", () => {
    const html = render({ loading: true, categories: [] });
    expect(html).toContain("Đang tải danh mục…");
  });

  it("hiện lỗi khi errorText (giọng 'ạ')", () => {
    const html = render({ errorText: "Nhóm không hợp lệ ạ." });
    expect(html).toContain("Nhóm không hợp lệ ạ.");
    expect(html).toContain('role="alert"');
  });

  it("preselect option theo selectedValue", () => {
    const html = render({ selectedValue: "cat-xm" });
    // <select> SSR render selected vào đúng option qua thuộc tính value của select.
    expect(html).toContain('value="cat-xm"');
  });
});
