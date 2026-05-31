import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  readSelect: vi.fn(),
  readEq: vi.fn(),
  readIs: vi.fn(),
  insert: vi.fn(),
  insertSelect: vi.fn(),
  single: vi.fn(),
}));

const readChain = {
  select: mocks.readSelect,
  eq: mocks.readEq,
  is: mocks.readIs,
};

const insertChain = {
  insert: mocks.insert,
};

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const { createCustomer } = await import("@/app/(app)/chat/actions");

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

  it("does not use service-role helpers", () => {
    const source = readFileSync("app/(app)/chat/actions.ts", "utf8");

    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("service_role");
  });
});
