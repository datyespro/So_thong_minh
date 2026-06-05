import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreviewCardPatch } from "@/src/components/chat/preview-card";
import type { ResolvedIntent } from "@/src/lib/ai/resolve-schema";
import {
  PREVIEW_DRAFT_SCHEMA_VERSION,
  loadDraft,
  saveDraft,
} from "@/src/lib/chat/preview-draft";

const STORAGE_KEY = "sotm:preview_draft:owner-1";

function emptyPatch(): PreviewCardPatch {
  return {
    itemPrices: {},
    itemQuantities: {},
    amount: null,
    customer: null,
    supplier: null,
    itemProducts: {},
    removedIndices: [],
    itemsAdded: [],
  };
}

function resolvedIntent(): ResolvedIntent {
  return {
    intent: "create_order",
    raw_text: "anh Hung mua 20 bao xi mang",
    amount: null,
    payment_status: "unknown",
    payment_method: null,
    customer: {
      raw: "anh Hung",
      entity_type: "customer",
      status: "resolved",
      resolved_id: "customer-1",
      resolved_name: "anh Hung",
      confidence: 1,
      candidates: [],
    },
    supplier: null,
    items: [
      {
        raw: "20 bao xi mang",
        product_name: "xi mang",
        quantity: 20,
        unit: "bao",
        unit_price: 80000,
        line_total: 1600000,
        confidence: 1,
        resolution: {
          raw: "xi mang",
          entity_type: "product",
          status: "resolved",
          resolved_id: "product-1",
          resolved_name: "xi mang",
          confidence: 1,
          candidates: [],
        },
      },
    ],
    overall_status: "all_resolved",
    needs_confirmation: false,
  };
}

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

  return { localStorage, store };
}

describe("preview draft storage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("round-trips one same-day owner-scoped draft", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T09:00:00+07:00"));
    installStorage();

    saveDraft("owner-1", {
      intent: "create_order",
      idempotencyKey: "idem-draft",
      resolved: resolvedIntent(),
      patched: emptyPatch(),
    });

    const draft = loadDraft("owner-1");

    expect(draft?.ownerId).toBe("owner-1");
    expect(draft?.businessDate).toBe("2026-06-05");
    expect(draft?.idempotencyKey).toBe("idem-draft");
    expect(draft?.resolved.intent).toBe("create_order");
  });

  it("returns null and clears malformed JSON", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T09:00:00+07:00"));
    const { store } = installStorage();
    store.set(STORAGE_KEY, "{bad");

    expect(loadDraft("owner-1")).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("returns null and clears schemaVersion or owner mismatches", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T09:00:00+07:00"));
    const { store } = installStorage();
    const baseDraft = {
      schemaVersion: PREVIEW_DRAFT_SCHEMA_VERSION,
      kind: "preview_draft",
      savedAt: "2026-06-05T09:00:00+07:00",
      businessDate: "2026-06-05",
      ownerId: "owner-1",
      intent: "create_order",
      idempotencyKey: "idem-draft",
      resolved: resolvedIntent(),
      patched: emptyPatch(),
    };

    store.set(STORAGE_KEY, JSON.stringify({ ...baseDraft, schemaVersion: 999 }));
    expect(loadDraft("owner-1")).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);

    store.set(STORAGE_KEY, JSON.stringify({ ...baseDraft, ownerId: "owner-2" }));
    expect(loadDraft("owner-1")).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it("returns null and clears drafts from a different Vietnam business day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T09:00:00+07:00"));
    const { store } = installStorage();

    store.set(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: PREVIEW_DRAFT_SCHEMA_VERSION,
        kind: "preview_draft",
        savedAt: "2026-06-04T23:00:00+07:00",
        businessDate: "2026-06-04",
        ownerId: "owner-1",
        intent: "create_order",
        idempotencyKey: "idem-draft",
        resolved: resolvedIntent(),
        patched: emptyPatch(),
      }),
    );

    expect(loadDraft("owner-1")).toBeNull();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });
});
