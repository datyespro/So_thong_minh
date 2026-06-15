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
  clearRestoredPreviewDraft,
  commitRestoredPreviewDraft,
  previewCommitTarget,
  resaveRestoredPreviewDraft,
  resolvedIntentForPreviewDraft,
  saveCurrentPreviewDraft,
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

function unresolvedValidated() {
  return baseValidated({
    items: [
      item({
        resolution: {
          raw: "xi măng",
          entity_type: "product",
          status: "not_found",
          resolved_id: null,
          resolved_name: null,
          confidence: 0,
          candidates: [],
        },
        issues: [
          {
            code: "product_unresolved",
            severity: "blocking",
            message: 'Không tìm thấy hàng "xi măng".',
            field_path: "items[0].product_name",
            item_index: 0,
          },
        ],
      }),
    ],
    ready_for_preview: false,
    blocking_count: 1,
  });
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

  it("keeps restored confirmation on the restored commit route", () => {
    expect(previewCommitTarget("restored", "create_order")).toBe("restored");
    expect(previewCommitTarget("restored", "record_payment")).toBe("restored");
    expect(previewCommitTarget("live", "create_order")).toBe("create_order");
  });

  it("persists an unresolved draft, re-saves its inline patch, and keeps one idempotency key across two reloads", async () => {
    const validated = unresolvedValidated();
    const patched = createEmptyPreviewCardPatch();

    saveCurrentPreviewDraft({
      ownerId: "owner-1",
      validated,
      patched,
      idempotencyKey: "idem-two-reloads",
    });

    const firstReload = loadDraft("owner-1");

    expect(firstReload?.resolved.items[0]?.resolution.status).toBe("not_found");
    expect(firstReload?.validated?.blocking_count).toBe(1);

    const resolvedPatch = {
      ...patched,
      itemProducts: {
        0: {
          entity_type: "product" as const,
          raw: "xi măng",
          resolved_id: "product-xi-mang",
          resolved_name: "xi măng",
        },
      },
    };
    const updated = resaveRestoredPreviewDraft(firstReload!, resolvedPatch);

    expect(updated?.patched.itemProducts[0]?.resolved_id).toBe(
      "product-xi-mang",
    );

    const secondReload = loadDraft("owner-1");

    expect(secondReload?.idempotencyKey).toBe("idem-two-reloads");
    expect(secondReload?.resolved.items[0]?.resolution.resolved_id).toBe(
      "product-xi-mang",
    );

    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: baseValidated() }),
    );
    mocks.commitOrder.mockResolvedValue({
      ok: true,
      data: {
        order_id: "order-once",
        total_amount: 1600000,
        debt_amount: 1600000,
        business_date: "2026-06-05",
      },
    });

    const result = await commitRestoredPreviewDraft(secondReload!);

    expect(result.ok).toBe(true);
    expect(mocks.commitOrder).toHaveBeenCalledTimes(1);
    expect(mocks.commitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ idempotency_key: "idem-two-reloads" }),
    );
    expect(loadDraft("owner-1")).toBeNull();
  });

  it("clears a restored draft through the dismiss path helper", () => {
    const draft = draftFixture();
    saveDraft(draft.ownerId, draft);

    clearRestoredPreviewDraft(draft);

    expect(loadDraft(draft.ownerId)).toBeNull();
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

  it("uses the inline-patched total when committing a restored partial payment", async () => {
    const initialValidated = unresolvedValidated();
    const validated = baseValidated({
      payment_status: "partial",
      paid_amount: 900000,
      effective_paid: 900000,
    });
    const patched = {
      ...createEmptyPreviewCardPatch(),
      itemPrices: { 0: 42500 },
      itemProducts: {
        0: {
          entity_type: "product" as const,
          raw: "xi măng",
          resolved_id: "product-xi-mang-inline",
          resolved_name: "xi măng",
        },
      },
    };
    const resolved = resolvedIntentForPreviewDraft(
      {
        ...initialValidated,
        payment_status: "partial",
        paid_amount: 900000,
        effective_paid: null,
      },
      patched,
    );

    if (!resolved) {
      throw new Error("expected draftable resolved intent");
    }

    const draft: PreviewDraft = {
      ...draftFixture(),
      validated: initialValidated,
      resolved,
      patched,
    };
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, data: validated }),
    );
    mocks.commitOrder.mockResolvedValue({
      ok: true,
      data: {
        order_id: "order-inline-paid",
        total_amount: 850000,
        debt_amount: 0,
        business_date: "2026-06-05",
      },
    });

    const result = await commitRestoredPreviewDraft(draft);

    expect(draft.resolved.payment_status).toBe("partial");
    expect(draft.resolved.paid_amount).toBe(900000);
    expect(draft.resolved.items[0]?.resolution.resolved_id).toBe(
      "product-xi-mang-inline",
    );
    expect(mocks.commitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paid_amount: 850000 }),
    );
    expect(result.ok).toBe(true);
  });
});
