import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CustomerManagementPreview,
  ProductManagementPreview,
} from "@/src/components/chat/preview-card";

const mocks = vi.hoisted(() => ({
  createProductFromChat: vi.fn(),
  deleteProduct: vi.fn(),
  persistCustomerManagementMessage: vi.fn(),
  persistProductManagementMessage: vi.fn(),
  updateCustomer: vi.fn(),
  updateCustomerPhone: vi.fn(),
  updateProduct: vi.fn(),
}));

vi.mock("@/app/(app)/chat/actions", () => ({
  commitOrder: vi.fn(),
  commitPayment: vi.fn(),
  commitPurchase: vi.fn(),
  createCustomer: vi.fn(),
  createSupplier: vi.fn(),
  createProduct: vi.fn(),
  createProductFromChat: mocks.createProductFromChat,
  deleteProduct: mocks.deleteProduct,
  getCustomerDebt: vi.fn(),
  persistDismissedPreviewMessage: vi.fn(),
  persistCustomerManagementMessage: mocks.persistCustomerManagementMessage,
  persistProductManagementMessage: mocks.persistProductManagementMessage,
  recreateSaleOrder: vi.fn(),
  searchCustomersByName: vi.fn(),
  searchSuppliersByName: vi.fn(),
  searchProductsByName: vi.fn(),
  undoCommit: vi.fn(),
  updateCustomer: mocks.updateCustomer,
  updateCustomerPhone: mocks.updateCustomerPhone,
  updateProduct: mocks.updateProduct,
}));

const {
  customerManagementChoiceEntity,
  customerManagementCustomerFromCandidate,
  historyCustomerCardFromDismissedPreview,
  historyCustomerCardFromResult,
  productManagementChoiceEntity,
  productManagementCreateFormFromPreview,
  productManagementProductFromCandidate,
  historyProductCardFromDismissedPreview,
  historyProductCardFromResult,
  persistProductManagementHistory,
  saveCustomerManagementPreview,
  saveProductManagementCreatePreview,
  saveProductManagementDeletePreview,
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
    mocks.deleteProduct.mockReset();
    mocks.persistCustomerManagementMessage.mockReset();
    mocks.persistProductManagementMessage.mockReset();
    mocks.updateCustomer.mockReset();
    mocks.updateCustomerPhone.mockReset();
    mocks.updateProduct.mockReset();
    mocks.persistCustomerManagementMessage.mockResolvedValue({
      ok: true,
      data: null,
    });
    mocks.persistProductManagementMessage.mockResolvedValue({
      ok: true,
      data: null,
    });
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

  it("deletes a confirmed product and returns the deleted preview", async () => {
    mocks.deleteProduct.mockResolvedValue({
      ok: true,
      data: {
        id: "product-fff",
        name: "fff",
        unit: "cái",
        sell_price: 12000,
      },
    });

    const result = await saveProductManagementDeletePreview({
      status: "confirm_delete",
      action: "delete",
      product: {
        id: "product-fff",
        name: "fff",
        unit: "cái",
        sell_price: 12000,
      },
    });

    expect(mocks.deleteProduct).toHaveBeenCalledWith("product-fff");
    expect(result).toEqual({
      ok: true,
      data: {
        status: "deleted",
        action: "delete",
        product: {
          id: "product-fff",
          name: "fff",
          unit: "cái",
          sell_price: 12000,
        },
      },
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

  it("builds persisted cards only from completed product results", () => {
    expect(
      historyProductCardFromResult({
        status: "saved",
        action: "set_unit",
        product: {
          id: "product-xi-mang",
          name: "xi măng",
          unit: "bao",
          sell_price: 100000,
        },
        target: { unit: "tấn" },
      }),
    ).toEqual({
      v: 1,
      kind: "manage_product",
      action: "set_unit",
      status: "saved",
      product_name: "xi măng",
      product_raw: null,
      unit: "tấn",
      sell_price: 100000,
    });

    expect(
      historyProductCardFromDismissedPreview({
        status: "confirm_delete",
        action: "delete",
        product: {
          id: "product-xi-mang",
          name: "xi măng",
          unit: "bao",
          sell_price: 100000,
        },
      }),
    ).toEqual({
      v: 1,
      kind: "manage_product",
      action: "delete",
      status: "dismissed",
      product_name: "xi măng",
      product_raw: null,
      unit: "bao",
      sell_price: 100000,
    });

    expect(
      historyProductCardFromDismissedPreview({
        status: "needs_choice",
        action: "delete",
        product_raw: "xi",
        candidates: [],
      }),
    ).toBeNull();
  });

  it("persists a canonical terminal product card after a client action", async () => {
    const card = historyProductCardFromResult({
      status: "deleted",
      action: "delete",
      product: {
        id: "product-fff",
        name: "fff",
        unit: "m³",
        sell_price: null,
      },
    });

    await persistProductManagementHistory(card);

    expect(mocks.persistProductManagementMessage).toHaveBeenCalledWith({
      card,
      content: "Đã xóa hàng fff khỏi danh sách.",
    });
  });

  it("does not throw when client-side history persistence fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.persistProductManagementMessage.mockRejectedValue(
      new Error("network down"),
    );

    await expect(
      persistProductManagementHistory({
        v: 1,
        kind: "manage_product",
        action: "create",
        status: "created",
        product_name: "cát vàng",
        product_raw: null,
        unit: "m³",
        sell_price: null,
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("saves customer rename through updateCustomer and builds the renamed card", async () => {
    const preview: Extract<
      CustomerManagementPreview,
      { status: "confirm_rename" }
    > = {
      status: "confirm_rename",
      action: "rename",
      customer: { id: "customer-lan", name: "chị Lan" },
      new_name: "Lan xóm Nghè",
    };
    mocks.updateCustomer.mockResolvedValue({
      ok: true,
      data: { id: "customer-lan", name: "Lan xóm Nghè" },
    });

    const result = await saveCustomerManagementPreview(preview);

    expect(mocks.updateCustomer).toHaveBeenCalledWith("customer-lan", {
      name: "Lan xóm Nghè",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        status: "renamed",
        action: "rename",
        customer: { id: "customer-lan", name: "chị Lan" },
        new_name: "Lan xóm Nghè",
      },
    });
    expect(
      result.ok ? historyCustomerCardFromResult(result.data) : null,
    ).toEqual({
      v: 1,
      kind: "manage_customer",
      action: "rename",
      status: "renamed",
      customer_name: "chị Lan",
      customer_raw: null,
      new_name: "Lan xóm Nghè",
      phone_raw: null,
    });
  });

  it("saves customer phone through updateCustomerPhone and builds the phone history card", async () => {
    const preview: Extract<
      CustomerManagementPreview,
      { status: "confirm_set_phone" }
    > = {
      status: "confirm_set_phone",
      action: "set_phone",
      customer: { id: "customer-lan", name: "chị Lan" },
      phone_raw: "0987654321",
      current_phone: null,
    };
    mocks.updateCustomerPhone.mockResolvedValue({
      ok: true,
      data: { id: "customer-lan", name: "chị Lan", phone: "0987654321" },
    });

    const result = await saveCustomerManagementPreview(preview);

    expect(mocks.updateCustomerPhone).toHaveBeenCalledWith(
      "customer-lan",
      "0987654321",
    );
    expect(result).toEqual({
      ok: true,
      data: {
        status: "phone_set",
        action: "set_phone",
        customer: { id: "customer-lan", name: "chị Lan" },
        phone_raw: "0987654321",
      },
    });
    expect(
      result.ok ? historyCustomerCardFromResult(result.data) : null,
    ).toEqual({
      v: 1,
      kind: "manage_customer",
      action: "set_phone",
      status: "phone_set",
      customer_name: "chị Lan",
      customer_raw: null,
      new_name: null,
      phone_raw: "0987654321",
    });
  });

  it("converts a selected customer candidate and builds a dismissed rename card", () => {
    const needsChoice: Extract<
      CustomerManagementPreview,
      { status: "needs_choice" }
    > = {
      status: "needs_choice",
      action: "rename",
      customer_raw: "Lan",
      new_name: "Lan xóm Nghè",
      candidates: [
        { id: "customer-lan-a", name: "chị Lan" },
        { id: "customer-lan-b", name: "cô Lan" },
      ],
    };

    expect(customerManagementChoiceEntity(needsChoice)).toMatchObject({
      raw: "Lan",
      entity_type: "customer",
      status: "ambiguous",
      candidates: [
        { id: "customer-lan-a", name: "chị Lan" },
        { id: "customer-lan-b", name: "cô Lan" },
      ],
    });
    expect(
      customerManagementCustomerFromCandidate(needsChoice.candidates[1]),
    ).toEqual({ id: "customer-lan-b", name: "cô Lan" });
    expect(
      historyCustomerCardFromDismissedPreview({
        status: "confirm_rename",
        action: "rename",
        customer: { id: "customer-lan-a", name: "chị Lan" },
        new_name: "Lan xóm Nghè",
      }),
    ).toEqual({
      v: 1,
      kind: "manage_customer",
      action: "rename",
      status: "dismissed",
      customer_name: "chị Lan",
      customer_raw: null,
      new_name: "Lan xóm Nghè",
      phone_raw: null,
    });
  });
});
