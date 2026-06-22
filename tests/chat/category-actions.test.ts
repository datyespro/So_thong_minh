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
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

const { createCategory, renameCategory, deleteCategory, updateProduct } =
  await import("@/app/(app)/chat/actions");

function resetAll() {
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
  mocks.update.mockReturnValue(updateChain);
  mocks.updateEq.mockReturnValue(updateChain);
  mocks.updateIs.mockReturnValue(updateChain);
  mocks.updateSelect.mockReturnValue(updateChain);
  mocks.insert.mockResolvedValue({ error: null });
}

describe("createCategory", () => {
  beforeEach(() => {
    resetAll();
    mocks.readIs.mockResolvedValue({ data: [], error: null });
    mocks.insert.mockReturnValue({ select: mocks.insertSelect });
    mocks.insertSelect.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: { id: "cat-1", name: "Sắt thép" },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(insertChain);
  });

  it("inserts an owner-scoped category and writes an audit row", async () => {
    const result = await createCategory("  Sắt thép  ");

    expect(result).toEqual({ ok: true, data: { id: "cat-1", name: "Sắt thép" } });
    expect(mocks.from).toHaveBeenNthCalledWith(1, "product_categories");
    expect(mocks.from).toHaveBeenNthCalledWith(2, "product_categories");
    expect(mocks.from).toHaveBeenNthCalledWith(3, "audit_log");
    expect(mocks.readEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.readIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      name: "Sắt thép",
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product_category",
      entity_id: "cat-1",
      action: "create",
      before_data: null,
      after_data: { name: "Sắt thép" },
      metadata: { source: "createCategory" },
    });
  });

  it("rejects a blank name without querying", async () => {
    const result = await createCategory("   ");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Tên danh mục không được để trống",
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("blocks a duplicate active name case-insensitively without inserting", async () => {
    mocks.readIs.mockResolvedValue({
      data: [{ id: "cat-existing", name: "Sắt thép" }],
      error: null,
    });
    mocks.from.mockReset();
    mocks.from.mockReturnValueOnce(readChain);

    const result = await createCategory("sắt thép");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Đã có danh mục tên này rồi ạ.",
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("renameCategory", () => {
  beforeEach(() => {
    resetAll();
    mocks.readIs
      .mockReturnValueOnce(readChain) // before-read continues to maybeSingle
      .mockResolvedValueOnce({
        data: [{ id: "cat-1", name: "sắt thép" }],
        error: null,
      }); // dedup read terminal
    mocks.readMaybeSingle.mockResolvedValue({
      data: { id: "cat-1", name: "sắt thép" },
      error: null,
    });
    mocks.updateMaybeSingle.mockResolvedValue({
      data: { id: "cat-1", name: "Sắt & Thép" },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);
  });

  it("renames an owner-scoped category and writes before/after audit without touching products", async () => {
    const result = await renameCategory("cat-1", "  Sắt & Thép  ");

    expect(result).toEqual({ ok: true, data: { id: "cat-1", name: "Sắt & Thép" } });
    expect(mocks.from).not.toHaveBeenCalledWith("products");
    expect(mocks.update).toHaveBeenCalledWith({ name: "Sắt & Thép" });
    expect(mocks.updateEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "cat-1");
    expect(mocks.updateIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product_category",
      entity_id: "cat-1",
      action: "update",
      before_data: { name: "sắt thép" },
      after_data: { name: "Sắt & Thép" },
      metadata: { fields: ["name"] },
    });
  });
});

describe("deleteCategory", () => {
  beforeEach(() => {
    resetAll();
    mocks.readIs.mockReturnValue(readChain);
    mocks.readMaybeSingle.mockResolvedValue({
      data: { id: "cat-1", name: "Sắt thép" },
      error: null,
    });
    mocks.updateMaybeSingle.mockResolvedValue({
      data: { id: "cat-1" },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);
  });

  it("soft-deletes via deleted_at without nulling products.category_id", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-22T03:00:00.000Z"));

    const result = await deleteCategory("cat-1");

    expect(result).toEqual({ ok: true, data: { id: "cat-1" } });
    expect(mocks.from).not.toHaveBeenCalledWith("products");
    expect(mocks.update).toHaveBeenCalledWith({
      deleted_at: "2026-06-22T03:00:00.000Z",
    });
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("is_active");
    expect(mocks.updateEq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mocks.updateIs).toHaveBeenCalledWith("deleted_at", null);
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      actor_id: "user-a",
      entity_type: "product_category",
      entity_id: "cat-1",
      action: "delete",
      before_data: { name: "Sắt thép" },
      after_data: { deleted: true },
      metadata: { deleted_at: "2026-06-22T03:00:00.000Z" },
    });

    vi.useRealTimers();
  });
});

describe("updateProduct category_id ownership (R1)", () => {
  beforeEach(() => {
    resetAll();
    mocks.readIs.mockReturnValue(readChain);
    mocks.updateMaybeSingle.mockResolvedValue({
      data: {
        id: "product-1",
        name: "Thép D12",
        unit: "cây",
        sell_price: null,
        category_id: null,
      },
      error: null,
    });
  });

  it("rejects assigning a new category that is not an active owner category", async () => {
    mocks.readMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "product-1",
          name: "Thép D12",
          unit: "cây",
          sell_price: null,
          category_id: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(readChain);

    const result = await updateProduct("product-1", {
      category_id: "cat-other-owner",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Danh mục không hợp lệ ạ.",
    });
    expect(mocks.from).toHaveBeenNthCalledWith(2, "product_categories");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows removing the category (null) without checking product_categories", async () => {
    mocks.readMaybeSingle.mockResolvedValue({
      data: {
        id: "product-1",
        name: "Thép D12",
        unit: "cây",
        sell_price: null,
        category_id: "cat-1",
      },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);

    const result = await updateProduct("product-1", { category_id: null });

    expect(result.ok).toBe(true);
    expect(mocks.from).not.toHaveBeenCalledWith("product_categories");
    expect(mocks.update).toHaveBeenCalledWith({ category_id: null });
  });

  it("allows editing other fields while keeping an unchanged (even deleted) category", async () => {
    mocks.readMaybeSingle.mockResolvedValue({
      data: {
        id: "product-1",
        name: "Thép D12",
        unit: "cây",
        sell_price: null,
        category_id: "cat-dead",
      },
      error: null,
    });
    mocks.updateMaybeSingle.mockResolvedValue({
      data: {
        id: "product-1",
        name: "Thép D12",
        unit: "cây",
        sell_price: "90000",
        category_id: "cat-dead",
      },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);

    const result = await updateProduct("product-1", {
      sell_price: "90.000",
      category_id: "cat-dead",
    });

    expect(result.ok).toBe(true);
    expect(mocks.from).not.toHaveBeenCalledWith("product_categories");
    expect(mocks.update).toHaveBeenCalledWith({
      sell_price: 90000,
      category_id: "cat-dead",
    });
  });

  it("assigns a new active owner category and audits the change", async () => {
    mocks.readMaybeSingle
      .mockResolvedValueOnce({
        data: {
          id: "product-1",
          name: "Thép D12",
          unit: "cây",
          sell_price: null,
          category_id: null,
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { id: "cat-1" }, error: null });
    mocks.updateMaybeSingle.mockResolvedValue({
      data: {
        id: "product-1",
        name: "Thép D12",
        unit: "cây",
        sell_price: null,
        category_id: "cat-1",
      },
      error: null,
    });
    mocks.from
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(readChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(insertChain);

    const result = await updateProduct("product-1", { category_id: "cat-1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.category_id).toBe("cat-1");
    }
    expect(mocks.from).toHaveBeenNthCalledWith(2, "product_categories");
    expect(mocks.update).toHaveBeenCalledWith({ category_id: "cat-1" });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "product",
        action: "update",
        before_data: expect.objectContaining({ category_id: null }),
        after_data: expect.objectContaining({ category_id: "cat-1" }),
        metadata: { fields: ["category_id"] },
      }),
    );
  });
});
