import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  validateIntent: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

vi.mock("@/src/lib/ai/validate-intent", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/validate-intent")>();

  return {
    ...actual,
    validateIntent: mocks.validateIntent,
  };
});

const { POST } = await import("@/app/api/ai/validate-intent/route");

const validResolved = {
  intent: "query_debt",
  raw_text: "Co Lan no bao nhieu?",
  amount: null,
  payment_status: "unknown",
  payment_method: null,
  customer: {
    raw: "co Lan",
    entity_type: "customer",
    status: "resolved",
    resolved_id: "customer-lan",
    resolved_name: "C\u00f4 Lan",
    confidence: 1,
    candidates: [
      {
        id: "customer-lan",
        name: "C\u00f4 Lan",
        score: 1,
        matched_on: "name_exact",
        matched_value: "C\u00f4 Lan",
      },
    ],
  },
  supplier: {
    raw: null,
    entity_type: "supplier",
    status: "not_found",
    resolved_id: null,
    resolved_name: null,
    confidence: 0,
    candidates: [],
  },
  items: [],
  overall_status: "all_resolved",
  needs_confirmation: false,
};

const validValidated = {
  intent: "query_debt",
  kind: "query",
  raw_text: "Co Lan no bao nhieu?",
  customer: validResolved.customer,
  supplier: validResolved.supplier,
  items: [],
  effective_amount: null,
  issues: [],
  ready_for_preview: false,
  blocking_count: 0,
  warning_count: 0,
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/validate-intent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/validate-intent", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.validateIntent.mockReset();
    mocks.validateIntent.mockResolvedValue(validValidated);
  });

  it("requires auth", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(jsonRequest({ resolved: validResolved }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Please log in.",
    });
    expect(mocks.validateIntent).not.toHaveBeenCalled();
  });

  it("validates the resolved intent body", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({ resolved: { intent: "bad" } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_INPUT");
    expect(mocks.validateIntent).not.toHaveBeenCalled();
  });

  it("returns validated data without direct route writes", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({ resolved: validResolved }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: validValidated });
    expect(mocks.validateIntent).toHaveBeenCalledWith({
      resolved: validResolved,
      ownerId: "user-a",
      supabase: expect.objectContaining({
        from: mocks.from,
      }),
    });

    for (const table of [
      "orders",
      "payments",
      "purchases",
      "inventory_movements",
      "pending_previews",
      "usage_events",
      "chat_messages",
      "customers",
      "products",
      "suppliers",
    ]) {
      expect(mocks.from).not.toHaveBeenCalledWith(table);
    }
  });
});
