import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  readSelect: vi.fn(),
  readEq: vi.fn(),
  readIs: vi.fn(),
  readMaybeSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  updateIs: vi.fn(),
  updateSelect: vi.fn(),
  updateMaybeSingle: vi.fn(),
  insert: vi.fn(),
  insertSelect: vi.fn(),
  single: vi.fn(),
}));

const readChain = {
  select: mocks.readSelect,
  eq: mocks.readEq,
  is: mocks.readIs,
  maybeSingle: mocks.readMaybeSingle,
};

const insertChain = {
  insert: mocks.insert,
};

const updateChain = {
  update: mocks.update,
  eq: mocks.updateEq,
  is: mocks.updateIs,
  select: mocks.updateSelect,
  maybeSingle: mocks.updateMaybeSingle,
};

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const {
  createCustomer,
  createProduct,
  createProductFromChat,
  searchCustomersByName,
  searchProductsByName,
  updateProduct,
} = await import("@/app/(app)/chat/actions");

beforeEach(() => {
  mocks.readMaybeSingle.mockReset();
  mocks.update.mockReset();
  mocks.updateEq.mockReset();
  mocks.updateIs.mockReset();
  mocks.updateSelect.mockReset();
  mocks.updateMaybeSingle.mockReset();
});

describe("createCustomer", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.insert.mockReset();
    mocks.insertSelect.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.readSelect.mockReturnValue(readChain);
    mocks.readEq.mockReturnValue(readChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: { id: "customer-phat", name: "anh Phát" },
      error: null,
    });
    mocks.from.mockReturnValueOnce(readChain).mockReturnValueOnce(insertChain);
  });

  it("inserts a customer scoped to the authenticated owner", async () => {
    const result = await createCustomer("  anh Phát  ");

    expect(result).toEqual({
      ok: true,
      data: { id: "customer-phat", name: "anh Phát" },
    });
    expect(mocks.from).toHaveBeenNthCalledWith(1, "customers");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "customers");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "anh Phát",
    });
    expect(mocks.insertSelect).toHaveBeenCalledWith("id,name");
  });

  it("rejects blank names without inserting", async () => {
    const result = await createCustomer("   ");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an existing customer on duplicate name without inserting", async () => {
    mocks.readIs.mockResolvedValue({
      data: [{ id: "customer-existing", name: "anh Phát" }],
      error: null,
    });

    const result = await createCustomer("anh phát");

    expect(result).toEqual({
      ok: true,
      data: { id: "customer-existing", name: "anh Phát" },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("searches customers by exact name without writing", async () => {
    mocks.readIs.mockResolvedValue({
      data: [
        { id: "customer-tuan", name: "anh Tuấn", aliases: [] },
        { id: "customer-lan", name: "chị Lan", aliases: [] },
      ],
      error: null,
    });

    const result = await searchCustomersByName("anh Tuấn");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        raw: "anh Tuấn",
        entity_type: "customer",
        status: "resolved",
        resolved_id: "customer-tuan",
        resolved_name: "anh Tuấn",
        candidates: [
          {
            id: "customer-tuan",
            name: "anh Tuấn",
            matched_on: "name_exact",
          },
        ],
      });
    }
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("customers");
    expect(mocks.readSelect).toHaveBeenCalledWith("id,name,aliases");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("searches customers by alias and fuzzy matching", async () => {
    mocks.readIs.mockResolvedValue({
      data: [
        { id: "customer-tuan", name: "anh Tuấn", aliases: ["Tuấn"] },
        { id: "customer-lan", name: "chị Lan", aliases: [] },
      ],
      error: null,
    });

    const aliasResult = await searchCustomersByName("Tuấn");

    expect(aliasResult.ok).toBe(true);
    if (aliasResult.ok) {
      expect(aliasResult.data.resolved_id).toBe("customer-tuan");
      expect(aliasResult.data.candidates[0].matched_on).toBe("alias_exact");
    }

    mocks.readIs.mockResolvedValue({
      data: [
        { id: "customer-tuan", name: "anh Tuấn", aliases: [] },
        { id: "customer-lan", name: "chị Lan", aliases: [] },
      ],
      error: null,
    });
    mocks.from.mockReset();
    mocks.from.mockReturnValue(readChain);

    const fuzzyResult = await searchCustomersByName("Tuan");

    expect(fuzzyResult.ok).toBe(true);
    if (fuzzyResult.ok) {
      expect(fuzzyResult.data.resolved_id).toBe("customer-tuan");
      expect(fuzzyResult.data.candidates[0].matched_on).toBe("fuzzy");
    }
  });

  it("returns an empty customer resolution for blank search without querying rows", async () => {
    const result = await searchCustomersByName("   ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        raw: null,
        entity_type: "customer",
        status: "not_found",
        resolved_id: null,
        resolved_name: null,
        candidates: [],
      });
    }
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not use service-role helpers", () => {
    const source = readFileSync("app/(app)/chat/actions.ts", "utf8");

    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("service_role");
  });
});

describe("createProduct", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.insert.mockReset();
    mocks.insertSelect.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.readSelect.mockReturnValue(readChain);
    mocks.readEq.mockReturnValue(readChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        id: "product-xi-mang-hoang-thach",
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(insertChain);
  });

  it("creates a product scoped to the authenticated owner and writes audit", async () => {
    const result = await createProduct("  Xi măng Hoàng Thạch  ", "bao");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-xi-mang-hoang-thach",
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
    });
    expect(mocks.from).toHaveBeenNthCalledWith(1, "products");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "products");
    expect(mocks.from).toHaveBeenNthCalledWith(3, "audit_log");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "Xi măng Hoàng Thạch",
      unit: "bao",
      is_active: true,
    });
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("sell_price");
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("cost_price");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product",
      entity_id: "product-xi-mang-hoang-thach",
      action: "create",
      before_data: null,
      after_data: {
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
      metadata: {
        source: "createProduct",
        fields: ["name", "unit", "sell_price"],
      },
    });
    expect(mocks.insertSelect).toHaveBeenCalledWith("id,name,unit,sell_price");
  });

  it("creates a product with unit and an explicit blank sell price", async () => {
    const result = await createProduct("Xi măng Hoàng Thạch", "bao", null);

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-xi-mang-hoang-thach",
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "Xi măng Hoàng Thạch",
      unit: "bao",
      sell_price: null,
      is_active: true,
    });
    expect(mocks.from).toHaveBeenNthCalledWith(3, "audit_log");
  });

  it("creates a product with unit and parsed sell price", async () => {
    mocks.single.mockResolvedValue({
      data: {
        id: "product-thep",
        name: "Thép phi 12",
        unit: "cây",
        sell_price: "80000",
      },
      error: null,
    });

    const result = await createProduct("Thép phi 12", "cây", "80.000");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-thep",
        name: "Thép phi 12",
        unit: "cây",
        sell_price: 80000,
      },
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "Thép phi 12",
      unit: "cây",
      sell_price: 80000,
      is_active: true,
    });
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("cost_price");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product",
      entity_id: "product-thep",
      action: "create",
      before_data: null,
      after_data: {
        name: "Thép phi 12",
        unit: "cây",
        sell_price: 80000,
      },
      metadata: {
        source: "createProduct",
        fields: ["name", "unit", "sell_price"],
      },
    });
  });

  it("returns an existing product on duplicate name without inserting", async () => {
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-existing",
          name: "Xi măng Hoàng Thạch",
          unit: "bao",
          sell_price: null,
        },
      ],
      error: null,
    });

    const result = await createProduct("xi măng hoàng thạch");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-existing",
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects blank product names without inserting", async () => {
    const result = await createProduct("");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects blank product units without inserting", async () => {
    const result = await createProduct("Xi măng Hoàng Thạch", "   ");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Đơn vị không được để trống",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects negative product sell prices without inserting", async () => {
    const result = await createProduct("Xi măng Hoàng Thạch", "bao", "-5");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Giá không hợp lệ",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("retries the dedup read after a product unique violation", async () => {
    mocks.from.mockReset();
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(readChain);
    mocks.readIs
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: "product-existing",
            name: "Xi măng Hoàng Thạch",
            unit: "bao",
            sell_price: null,
          },
        ],
        error: null,
      });
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });

    const result = await createProduct("Xi măng Hoàng Thạch", "bao");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-existing",
        name: "Xi măng Hoàng Thạch",
        unit: "bao",
        sell_price: null,
      },
    });
    expect(mocks.from).toHaveBeenCalledTimes(3);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });
});

describe("createProductFromChat", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.insert.mockReset();
    mocks.insertSelect.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.readSelect.mockReturnValue(readChain);
    mocks.readEq.mockReturnValue(readChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        id: "product-gach-do",
        name: "gạch đỏ",
        unit: "bao",
        sell_price: 85000,
      },
      error: null,
    });
  });

  it("returns a duplicate error before createProduct can insert", async () => {
    mocks.from.mockReturnValueOnce(readChain);
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-existing",
          name: "Gạch đỏ",
          unit: "viên",
          sell_price: null,
        },
      ],
      error: null,
    });

    const result = await createProductFromChat({
      name: "gạch đỏ",
      unit: "bao",
      sell_price: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Hàng này có thể đã tồn tại. Bác kiểm tra lại danh sách hàng nhé.",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.readIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("delegates to createProduct when the chat duplicate guard passes", async () => {
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(insertChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });

    const result = await createProductFromChat({
      name: "  gạch đỏ  ",
      unit: "bao",
      sell_price: 85000,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-gach-do",
        name: "gạch đỏ",
        unit: "bao",
        sell_price: 85000,
      },
    });
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenCalledTimes(4);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "gạch đỏ",
      unit: "bao",
      sell_price: 85000,
      is_active: true,
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product",
      entity_id: "product-gach-do",
      action: "create",
      before_data: null,
      after_data: {
        name: "gạch đỏ",
        unit: "bao",
        sell_price: 85000,
      },
      metadata: {
        source: "createProduct",
        fields: ["name", "unit", "sell_price"],
      },
    });
  });
});

describe("searchProductsByName", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.insert.mockReset();
    mocks.insertSelect.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.readSelect.mockReturnValue(readChain);
    mocks.readEq.mockReturnValue(readChain);
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(readChain);
  });

  it("searches products by normalized exact name without writing", async () => {
    mocks.readIs.mockResolvedValue({
      data: [
        {
          id: "product-xi-mang",
          name: "Xi măng",
          unit: "bao",
          sell_price: 80000,
          aliases: [],
        },
        {
          id: "product-cat",
          name: "Cát",
          unit: "khối",
          sell_price: null,
          aliases: [],
        },
      ],
      error: null,
    });

    const result = await searchProductsByName("xi mang");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        raw: "xi mang",
        entity_type: "product",
        status: "resolved",
        resolved_id: "product-xi-mang",
        resolved_name: "Xi măng",
        candidates: [
          {
            id: "product-xi-mang",
            name: "Xi măng",
            unit: "bao",
            sell_price: 80000,
            matched_on: "name_exact",
          },
        ],
      });
    }
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("products");
    expect(mocks.readSelect).toHaveBeenCalledWith(
      "id,name,aliases,unit,sell_price",
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an empty product resolution for blank search without querying rows", async () => {
    const result = await searchProductsByName("   ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        raw: null,
        entity_type: "product",
        status: "not_found",
        resolved_id: null,
        resolved_name: null,
        candidates: [],
      });
    }
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns not_found when product search has no match", async () => {
    mocks.readIs.mockResolvedValue({
      data: [{ id: "product-xi-mang", name: "Xi măng", unit: "bao", aliases: [] }],
      error: null,
    });

    const result = await searchProductsByName("zzzzzzzz");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        raw: "zzzzzzzz",
        entity_type: "product",
        status: "not_found",
        resolved_id: null,
        resolved_name: null,
        candidates: [],
      });
    }
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("updateProduct", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.readSelect.mockReset();
    mocks.readEq.mockReset();
    mocks.readIs.mockReset();
    mocks.readMaybeSingle.mockReset();
    mocks.update.mockReset();
    mocks.updateEq.mockReset();
    mocks.updateIs.mockReset();
    mocks.updateSelect.mockReset();
    mocks.updateMaybeSingle.mockReset();
    mocks.insert.mockReset();
    mocks.insertSelect.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.readSelect.mockReturnValue(readChain);
    mocks.readEq.mockReturnValue(readChain);
    mocks.readIs.mockReturnValue(readChain);
    mocks.readMaybeSingle.mockResolvedValue({
      data: { id: "product-xi-mang", unit: "cái", sell_price: null },
      error: null,
    });
    mocks.update.mockReturnValue(updateChain);
    mocks.updateEq.mockReturnValue(updateChain);
    mocks.updateIs.mockReturnValue(updateChain);
    mocks.updateSelect.mockReturnValue(updateChain);
    mocks.updateMaybeSingle.mockResolvedValue({
      data: { id: "product-xi-mang", unit: "bao", sell_price: "80000" },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);
  });

  it("updates only unit and sell price for the authenticated owner and writes audit", async () => {
    const result = await updateProduct("product-xi-mang", {
      unit: " bao ",
      sell_price: "80.000",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: "product-xi-mang",
        unit: "bao",
        sell_price: 80000,
      },
    });
    expect(mocks.from).toHaveBeenNthCalledWith(1, "products");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "products");
    expect(mocks.from).toHaveBeenNthCalledWith(3, "audit_log");
    expect(mocks.update).toHaveBeenCalledWith({
      unit: "bao",
      sell_price: 80000,
    });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("current_stock");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("cost_price");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("name");
    expect(mocks.updateEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "product-xi-mang");
    expect(mocks.updateEq).toHaveBeenCalledWith("is_active", true);
    expect(mocks.updateIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product",
      entity_id: "product-xi-mang",
      action: "update",
      before_data: {
        unit: "cái",
        sell_price: null,
      },
      after_data: {
        unit: "bao",
        sell_price: 80000,
      },
      metadata: {
        fields: ["unit", "sell_price"],
      },
    });
  });

  it("rejects a blank unit without touching the database", async () => {
    const result = await updateProduct("product-xi-mang", {
      unit: " ",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Đơn vị không được để trống",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("blocks products that are not visible through the owner filter", async () => {
    mocks.readMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await updateProduct("other-owner-product", {
      unit: "bao",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để sửa.",
    });
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readEq).toHaveBeenCalledWith("id", "other-owner-product");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
