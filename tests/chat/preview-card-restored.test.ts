import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPreviewCardPatch } from "@/src/components/chat/preview-card";
import type { PreviewDraft } from "@/src/lib/chat/preview-draft";
import { loadDraft, saveDraft } from "@/src/lib/chat/preview-draft";
import {
  baseValidated,
  item,
  missingPriceIssue,
} from "@/tests/chat/preview-card-fixtures";

const mocks = vi.hoisted(() => ({
  commitOrder: vi.fn(),
}));

vi.mock("@/app/(app)/chat/actions", () => ({
  commitOrder: mocks.commitOrder,
  commitPayment: vi.fn(),
  commitPurchase: vi.fn(),
  createCustomer: vi.fn(),
  createSupplier: vi.fn(),
  createProduct: vi.fn(),
  createProductFromChat: vi.fn(),
  deleteProduct: vi.fn(),
  getCustomerDebt: vi.fn(),
  persistDismissedPreviewMessage: vi.fn(),
  persistProductManagementMessage: vi.fn(),
  recreateSaleOrder: vi.fn(),
  searchCustomersByName: vi.fn(),
  searchSuppliersByName: vi.fn(),
  searchProductsByName: vi.fn(),
  undoCommit: vi.fn(),
  updateProduct: vi.fn(),
}));

const {
  commitRestoredPreviewDraft,
  resolvedIntentForPreviewDraft,
} = await import("@/src/components/chat/preview-card/preview-card");

function installStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };

  vi.stubGlobal("window", { localStorage });

  return { store };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function draftFixture(): PreviewDraft {
  const patched = createEmptyPreviewCardPatch();
  const resolved = resolvedIntentForPreviewDraft(baseValidated(), patched);

  if (!resolved) {
    throw new Error("expected draftable resolved intent");
  }

  return {
    schemaVersion: 1,
    kind: "preview_draft",
    savedAt: "2026-06-05T09:00:00+07:00",
    businessDate: "2026-06-05",
    ownerId: "owner-1",
    intent: "create_order",
    idempotencyKey: "idem-from-draft",
    resolved,
    patched,
  };
}

describe("restored preview draft commit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T09:00:00+07:00"));
    installStorage();
    mocks.commitOrder.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("revalidates via the validate route, commits with the draft idempotency key, and clears the draft", async () => {
    const draft = draftFixture();
    saveDraft(draft.ownerId, draft);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: baseValidated() }),
    );
    mocks.commitOrder.mockResolvedValue({
      ok: true,
      data: {
        order_id: "order-1",
        total_amount: 1600000,
        debt_amount: 1600000,
        business_date: "2026-06-05",
      },
    });

    const result = await commitRestoredPreviewDraft(draft);

    expect(fetch).toHaveBeenCalledWith(
      "/api/ai/validate-intent",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ resolved: draft.resolved }),
      }),
    );
    expect(mocks.commitOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: "idem-from-draft",
      }),
    );
    expect(result.ok).toBe(true);
    expect(loadDraft("owner-1")).toBeNull();
  });

  it("does not commit and re-saves the same draft when revalidation blocks confirmation", async () => {
    const draft = draftFixture();
    const blockedValidated = baseValidated({
      items: [
        item({
          unit_price: null,
          effective_unit_price: null,
          line_total: null,
          issues: [missingPriceIssue()],
        }),
      ],
      effective_amount: null,
      ready_for_preview: false,
      blocking_count: 1,
    });
    saveDraft(draft.ownerId, draft);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: blockedValidated }),
    );

    const result = await commitRestoredPreviewDraft(draft);

    expect(result.ok).toBe(false);
    expect(mocks.commitOrder).not.toHaveBeenCalled();
    expect(loadDraft("owner-1")?.idempotencyKey).toBe("idem-from-draft");
  });

  it("preserves the transaction date through draft serialization and restored commit", async () => {
    const validated = baseValidated({ business_date: "2026-06-01" });
    const patched = createEmptyPreviewCardPatch();
    const resolved = resolvedIntentForPreviewDraft(validated, patched);

    if (!resolved) {
      throw new Error("expected draftable resolved intent");
    }

    expect(resolved.business_date).toBe("2026-06-01");
    expect(
      resolvedIntentForPreviewDraft(baseValidated(), patched),
    ).not.toHaveProperty("business_date");

    const draft: PreviewDraft = {
      ...draftFixture(),
      resolved,
    };
    saveDraft(draft.ownerId, draft);
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: validated }),
    );
    mocks.commitOrder.mockResolvedValue({
      ok: true,
      data: {
        order_id: "order-dated",
        total_amount: 1600000,
        debt_amount: 1600000,
        business_date: "2026-06-01",
      },
    });

    const result = await commitRestoredPreviewDraft(draft);

    expect(fetch).toHaveBeenCalledWith(
      "/api/ai/validate-intent",
      expect.objectContaining({
        body: JSON.stringify({ resolved: draft.resolved }),
      }),
    );
    expect(mocks.commitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ business_date: "2026-06-01" }),
    );
    expect(result.ok).toBe(true);
  });
});
