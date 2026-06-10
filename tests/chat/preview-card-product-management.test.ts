import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductManagementPreview } from "@/src/components/chat/preview-card";

const mocks = vi.hoisted(() => ({
  createProductFromChat: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/app/(app)/chat/actions", () => ({
  commitOrder: vi.fn(),
  commitPayment: vi.fn(),
  commitPurchase: vi.fn(),
  createCustomer: vi.fn(),
  createProduct: vi.fn(),
  createProductFromChat: mocks.createProductFromChat,
  getCustomerDebt: vi.fn(),
  persistDismissedPreviewMessage: vi.fn(),
  recreateSaleOrder: vi.fn(),
  searchCustomersByName: vi.fn(),
  searchProductsByName: vi.fn(),
  undoCommit: vi.fn(),
  updateProduct: mocks.updateProduct,
}));

const {
  productManagementChoiceEntity,
  productManagementCreateFormFromPreview,
  productManagementProductFromCandidate,
  saveProductManagementCreatePreview,
  saveProductManagementPreview,
  validateProductManagementCreateForm,
} = await import("@/src/components/chat/preview-card/preview-card");

function readyPreview(
  overrides: Partial<Extract<ProductManagementPreview, { status: "ready" }>> = {},
): Extract<ProductManagementPreview, { status: "ready" }> {
  return {
    status: "ready",
    action: "set_unit",
    product: {
      id: "product-xi-mang",
      name: "Xi măng",
      unit: "cái",
      sell_price: null,
    },
    target: { unit: "bao" },
    ...overrides,
  };
}

describe("product-management preview helpers", () => {
  beforeEach(() => {
    mocks.createProductFromChat.mockReset();
    mocks.updateProduct.mockReset();
  });

  it("saves set_unit through updateProduct with only the unit patch", async () => {
    mocks.updateProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-xi-mang", unit: "bao", sell_price: null },
    });

    const result = await saveProductManagementPreview(readyPreview());

    expect(mocks.updateProduct).toHaveBeenCalledWith("product-xi-mang", {
      unit: "bao",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        status: "saved",
        action: "set_unit",
        product: {
          id: "product-xi-mang",
          name: "Xi măng",
          unit: "cái",
          sell_price: null,
        },
        target: { unit: "bao" },
      },
    });
  });

  it("saves set_price through updateProduct with only the sell_price patch", async () => {
    mocks.updateProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-xi-mang", unit: "bao", sell_price: 85000 },
    });

    const result = await saveProductManagementPreview(
      readyPreview({
        action: "set_price",
        product: {
          id: "product-xi-mang",
          name: "Xi măng",
          unit: "bao",
          sell_price: null,
        },
        target: { sell_price: 85000 },
      }),
    );

    expect(mocks.updateProduct).toHaveBeenCalledWith("product-xi-mang", {
      sell_price: 85000,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        status: "saved",
        action: "set_price",
        target: { sell_price: 85000 },
      },
    });
  });

  it("converts a selected candidate into the product saved from a many-match picker", async () => {
    const needsChoice: Extract<ProductManagementPreview, { status: "needs_choice" }> = {
      status: "needs_choice",
      action: "set_unit",
      product_raw: "xi măng",
      target: { unit: "bao" },
      candidates: [
        {
          id: "product-a",
          name: "Xi măng A",
          unit: "cái",
          sell_price: null,
          score: 0.95,
          matched_on: "alias_exact",
          matched_value: "xi măng",
        },
        {
          id: "product-b",
          name: "Xi măng B",
          unit: "bao",
          sell_price: 90000,
          score: 0.95,
          matched_on: "alias_exact",
          matched_value: "xi măng",
        },
      ],
    };
    const choiceEntity = productManagementChoiceEntity(needsChoice);
    const selected = productManagementProductFromCandidate(needsChoice.candidates[1]);
    mocks.updateProduct.mockResolvedValue({
      ok: true,
      data: { id: "product-b", unit: "bao", sell_price: 90000 },
    });

    const result = await saveProductManagementPreview(
      readyPreview({
        product: selected,
        target: needsChoice.target,
      }),
    );

    expect(choiceEntity.candidates).toHaveLength(2);
    expect(selected.id).toBe("product-b");
    expect(mocks.updateProduct).toHaveBeenCalledWith("product-b", {
      unit: "bao",
    });
    expect(result.ok).toBe(true);
  });

  it("returns a compact error without producing a saved preview when updateProduct fails", async () => {
    mocks.updateProduct.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để sửa.",
    });

    const result = await saveProductManagementPreview(readyPreview());

    expect(result).toEqual({
      ok: false,
      message: "Không tìm thấy hàng để sửa.",
    });
  });

  it("builds chat create form state from create_draft preview", () => {
    expect(
      productManagementCreateFormFromPreview({
        status: "create_draft",
        action: "create",
        product_raw: "gạch đỏ",
        draft: {
          name: "gạch đỏ",
          unit: "cái",
          sell_price: null,
        },
      }),
    ).toEqual({
      name: "gạch đỏ",
      unit: "cái",
      sellPriceInput: "",
    });

    expect(
      productManagementCreateFormFromPreview({
        status: "create_draft",
        action: "create",
        product_raw: "sơn Dulux",
        draft: {
          name: "sơn Dulux",
          unit: "thùng",
          sell_price: 85000,
        },
      }),
    ).toEqual({
      name: "sơn Dulux",
      unit: "thùng",
      sellPriceInput: "85000",
    });
  });

  it("validates chat create draft fields before calling the server", () => {
    expect(
      validateProductManagementCreateForm({
        name: "   ",
        unit: "bao",
        sellPriceInput: "",
      }),
    ).toEqual({ ok: false, message: "Tên hàng bắt buộc" });

    expect(
      validateProductManagementCreateForm({
        name: "gạch đỏ",
        unit: "   ",
        sellPriceInput: "",
      }),
    ).toEqual({ ok: false, message: "Đơn vị bắt buộc" });

    expect(
      validateProductManagementCreateForm({
        name: "gạch đỏ",
        unit: "bao",
        sellPriceInput: "-5",
      }),
    ).toEqual({ ok: false, message: "Giá không hợp lệ" });

    expect(
      validateProductManagementCreateForm({
        name: "  gạch đỏ  ",
        unit: " bao ",
        sellPriceInput: "85.000",
      }),
    ).toEqual({
      ok: true,
      data: {
        name: "gạch đỏ",
        unit: "bao",
        sell_price: 85000,
      },
    });
  });

  it("does not call chat create action when local validation fails", async () => {
    const result = await saveProductManagementCreatePreview({
      name: "",
      unit: "bao",
      sellPriceInput: "",
    });

    expect(result).toEqual({ ok: false, message: "Tên hàng bắt buộc" });
    expect(mocks.createProductFromChat).not.toHaveBeenCalled();
  });

  it("saves chat create through the duplicate-guarded server action", async () => {
    mocks.createProductFromChat.mockResolvedValue({
      ok: true,
      data: {
        id: "product-gach-do",
        name: "gạch đỏ",
        unit: "bao",
        sell_price: 85000,
      },
    });

    const result = await saveProductManagementCreatePreview({
      name: "  gạch đỏ  ",
      unit: " bao ",
      sellPriceInput: "85.000",
    });

    expect(mocks.createProductFromChat).toHaveBeenCalledWith({
      name: "gạch đỏ",
      unit: "bao",
      sell_price: 85000,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        status: "created",
        action: "create",
        product: {
          id: "product-gach-do",
          name: "gạch đỏ",
          unit: "bao",
          sell_price: 85000,
        },
      },
    });
  });

  it("keeps the draft unsaved when chat create action reports duplicate", async () => {
    mocks.createProductFromChat.mockResolvedValue({
      ok: false,
      code: "validation_failed",
      message: "Hàng này có thể đã tồn tại. Bác kiểm tra lại danh sách hàng nhé.",
    });

    const result = await saveProductManagementCreatePreview({
      name: "gạch đỏ",
      unit: "bao",
      sellPriceInput: "",
    });

    expect(result).toEqual({
      ok: false,
      message: "Hàng này có thể đã tồn tại. Bác kiểm tra lại danh sách hàng nhé.",
    });
  });
});
