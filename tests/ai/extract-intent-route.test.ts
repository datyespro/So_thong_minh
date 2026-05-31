import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  extractIntent: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

vi.mock("@/src/lib/ai/extract-intent", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/lib/ai/extract-intent")>();

  return {
    ...actual,
    extractIntent: mocks.extractIntent,
  };
});

const { POST } = await import("@/app/api/ai/extract-intent/route");

const validExtracted = {
  intent: "query_inventory",
  confidence: 0.91,
  raw_text: "Còn bao nhiêu xi măng?",
  normalized_text: "còn bao nhiêu xi măng?",
  language: "vi",
  entities: {
    customer_name: null,
    supplier_name: null,
    product_name: "xi măng",
    items: [],
    amount: null,
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

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/extract-intent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/extract-intent", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.from.mockReset();
    mocks.insert.mockReset();
    mocks.extractIntent.mockReset();
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.extractIntent.mockResolvedValue(validExtracted);
  });

  it("requires auth and does not call AI when unauthenticated", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const response = await POST(jsonRequest({ text: "Cô Lan trả 500k" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Please log in.",
      },
    });
    expect(mocks.extractIntent).not.toHaveBeenCalled();
  });

  it("validates missing body text", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("EMPTY_INPUT");
    expect(mocks.extractIntent).not.toHaveBeenCalled();
  });

  it("returns structured data and logs chat_messages with owner_id", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });

    const response = await POST(jsonRequest({ text: "Còn bao nhiêu xi măng?" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: validExtracted });
    expect(mocks.extractIntent).toHaveBeenCalledWith({
      rawText: "Còn bao nhiêu xi măng?",
      ownerId: "user-a",
    });
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("chat_messages");

    for (const table of [
      "orders",
      "order_items",
      "payments",
      "purchases",
      "purchase_items",
      "inventory_movements",
      "pending_previews",
    ]) {
      expect(mocks.from).not.toHaveBeenCalledWith(table);
    }

    const insertedRows = mocks.insert.mock.calls[0][0];

    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({
      owner_id: "user-a",
      role: "user",
      intent: null,
    });
    expect(insertedRows[1]).toMatchObject({
      owner_id: "user-a",
      role: "assistant",
      intent: "query_inventory",
    });
  });

  it("returns success when chat logging fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-a" } },
      error: null,
    });
    mocks.insert.mockResolvedValue({
      error: {
        code: "42501",
        message: "RLS denied",
      },
    });

    const response = await POST(jsonRequest({ text: "Còn bao nhiêu xi măng?" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
