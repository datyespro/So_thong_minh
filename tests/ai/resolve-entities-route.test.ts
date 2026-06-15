import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  resolveEntities: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

vi.mock("@/src/lib/ai/resolve-entities", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/resolve-entities")>();

  return {
    ...actual,
    resolveEntities: mocks.resolveEntities,
  };
});

const { POST } = await import("@/app/api/ai/resolve-entities/route");

const validIntent = {
  intent: "query_inventory",
  confidence: 0.91,
  raw_text: "Con bao nhieu xi mang?",
  normalized_text: "con bao nhieu xi mang?",
  language: "vi",
  entities: {
    customer_name: null,
    supplier_name: null,
    product_name: "xi mang",
    product_management: null,
    items: [],
    amount: null,
    paid_amount: null,
    payment_status: "unknown",
    payment_method: null,
    order_reference: null,
    business_date: null,
    time_range: {
      raw: null,
      kind: "unknown",
      start_date: null,
      end_date: null,
    },
  },
  missing_info: [],
  warnings: [],
  needs_confirmation: false,
  next_stage_hint: "resolve_entities",
};

const validResolved = {
  intent: "query_inventory",
  raw_text: "Con bao nhieu xi mang?",
  customer: {
    raw: null,
    entity_type: "customer",
    status: "not_found",
    resolved_id: null,
    resolved_name: null,
    confidence: 0,
    candidates: [],
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

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/resolve-entities", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/resolve-entities", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.resolveEntities.mockReset();
    mocks.resolveEntities.mockResolvedValue(validResolved);
  });

  it("requires auth", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(jsonRequest({ intent: validIntent }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Please log in.",
    });
    expect(mocks.resolveEntities).not.toHaveBeenCalled();
  });

  it("validates the extracted intent body", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({ intent: { intent: "bad" } }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("EMPTY_INTENT");
    expect(mocks.resolveEntities).not.toHaveBeenCalled();
  });

  it("returns resolved data without direct route writes", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({ intent: validIntent }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: validResolved });
    expect(mocks.resolveEntities).toHaveBeenCalledWith({
      intent: validIntent,
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
    ]) {
      expect(mocks.from).not.toHaveBeenCalledWith(table);
    }
  });
});
