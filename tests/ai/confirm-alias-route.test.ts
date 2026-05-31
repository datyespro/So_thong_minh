import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  confirmAlias: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

vi.mock("@/src/lib/ai/alias-memory", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/alias-memory")>();

  return {
    ...actual,
    confirmAlias: mocks.confirmAlias,
  };
});

const { POST } = await import("@/app/api/ai/confirm-alias/route");

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/confirm-alias", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/confirm-alias", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.confirmAlias.mockReset();
    mocks.confirmAlias.mockResolvedValue({
      ok: true,
      data: {
        aliases: ["co lan beo"],
      },
    });
  });

  it("requires auth", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(
      jsonRequest({
        entity_type: "customer",
        entity_id: "customer-lan",
        alias: "co lan beo",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "unauthorized",
      message: "Please log in.",
    });
    expect(mocks.confirmAlias).not.toHaveBeenCalled();
  });

  it("validates the request body", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(
      jsonRequest({
        entity_type: "bad",
        entity_id: "customer-lan",
        alias: "co lan beo",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("validation_failed");
    expect(mocks.confirmAlias).not.toHaveBeenCalled();
  });

  it("delegates owner-scoped alias append", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(
      jsonRequest({
        entity_type: "customer",
        entity_id: "customer-lan",
        alias: "co lan beo",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: {
        aliases: ["co lan beo"],
      },
    });
    expect(mocks.confirmAlias).toHaveBeenCalledWith({
      supabase: expect.objectContaining({
        from: mocks.from,
      }),
      ownerId: "user-a",
      entityType: "customer",
      entityId: "customer-lan",
      alias: "co lan beo",
    });
  });
});
