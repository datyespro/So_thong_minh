import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const { sendMessage } = await import("@/app/(app)/chat/actions");

describe("sendMessage", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.select.mockReset();
    mocks.single.mockReset();

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.single.mockResolvedValue({
      data: {
        id: "message-1",
        role: "user",
        content: "Bán cô Lan 10 bao xi măng",
        created_at: "2026-05-29T03:00:00.000Z",
      },
      error: null,
    });
  });

  it("requires auth", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await sendMessage("Bán cô Lan 10 bao xi măng");

    expect(result).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects blank content without inserting", async () => {
    const result = await sendMessage("   ");

    expect(result).toEqual({
      ok: false,
      code: "validation_failed",
      message: "Bác chưa nhập gì ạ.",
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects content over 2000 characters without inserting", async () => {
    const result = await sendMessage("a".repeat(2001));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("inserts one owner-scoped user chat row", async () => {
    const result = await sendMessage("  Bán cô Lan 10 bao xi măng  ");

    expect(result).toEqual({
      ok: true,
      data: {
        id: "message-1",
        role: "user",
        content: "Bán cô Lan 10 bao xi măng",
        created_at: "2026-05-29T03:00:00.000Z",
      },
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("chat_messages");
    expect(mocks.insert).toHaveBeenCalledWith({
      owner_id: "user-a",
      role: "user",
      content: "Bán cô Lan 10 bao xi măng",
      intent: null,
      metadata: { source: "chat_ui_scaffold" },
    });
    expect(mocks.select).toHaveBeenCalledWith("id,role,content,created_at");
    expect(mocks.single).toHaveBeenCalledTimes(1);
  });

  it("does not write an assistant placeholder row", async () => {
    await sendMessage("Bán cô Lan 10 bao xi măng");

    const inserted = mocks.insert.mock.calls[0][0];

    expect(Array.isArray(inserted)).toBe(false);
    expect(inserted.role).toBe("user");
    expect(inserted.content).not.toContain("Phần xử lý đơn");
  });

  it("returns a friendly db_error on insert failure", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "RLS denied",
      },
    });

    const result = await sendMessage("Bán cô Lan 10 bao xi măng");

    expect(result).toEqual({
      ok: false,
      code: "db_error",
      message: "Chưa lưu được tin, bác thử lại ạ.",
    });
  });
});
