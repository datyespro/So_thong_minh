import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const { persistProductManagementMessage } = await import(
  "@/app/(app)/chat/actions"
);

const card = {
  v: 1,
  kind: "manage_product",
  action: "delete",
  status: "deleted",
  product_name: "fff",
  product_raw: null,
  unit: "m³",
  sell_price: null,
} as const;

describe("persistProductManagementMessage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "owner-a" } },
      error: null,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("persists one owner-scoped manage_product history card", async () => {
    const result = await persistProductManagementMessage({
      card,
      content: "Đã xóa hàng fff khỏi danh sách.",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(mocks.from).toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "owner-a",
      role: "assistant",
      content: "Đã xóa hàng fff khỏi danh sách.",
      intent: "manage_product",
      metadata: {
        card,
        source: "tip_33_product",
      },
    });
  });

  it("rejects unauthenticated callers before writing", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await persistProductManagementMessage({
      card,
      content: "Đã xóa hàng fff khỏi danh sách.",
    });

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects non-terminal product cards", async () => {
    const result = await persistProductManagementMessage({
      card: { ...card, status: "confirm_delete" },
      content: "Xác nhận xóa hàng",
    });

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Thẻ quản lý hàng chưa hợp lệ ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("keeps the product action successful when history insert fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.insert.mockResolvedValue({
      error: { code: "42501", message: "RLS denied" },
    });

    const result = await persistProductManagementMessage({
      card,
      content: "Đã xóa hàng fff khỏi danh sách.",
    });

    expect(result).toEqual({ ok: true, data: null });
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to persist assistant terminal chat message",
      { code: "42501", message: "RLS denied" },
    );

    warnSpy.mockRestore();
  });
});
