import type { PreviewCardPatch } from "@/src/components/chat/preview-card/types";
import {
  ResolvedIntentSchema,
  type ResolvedIntent,
} from "@/src/lib/ai/resolve-schema";
import { APP_TIME_ZONE, businessDateVN, dayjs } from "@/src/lib/dayjs";

export const PREVIEW_DRAFT_SCHEMA_VERSION = 1;

export type PreviewDraftIntent =
  | "create_order"
  | "record_payment"
  | "create_purchase";

export type PreviewDraft = Readonly<{
  schemaVersion: typeof PREVIEW_DRAFT_SCHEMA_VERSION;
  kind: "preview_draft";
  savedAt: string;
  businessDate: string;
  ownerId: string;
  intent: PreviewDraftIntent;
  idempotencyKey: string;
  resolved: ResolvedIntent;
  patched: PreviewCardPatch;
}>;

export type SavePreviewDraftInput = Readonly<{
  intent: PreviewDraftIntent;
  idempotencyKey: string;
  resolved: ResolvedIntent;
  patched: PreviewCardPatch;
}>;

const STORAGE_PREFIX = "sotm:preview_draft";
const WRITABLE_DRAFT_INTENTS = new Set<string>([
  "create_order",
  "record_payment",
  "create_purchase",
]);

function draftKey(ownerId: string) {
  return `${STORAGE_PREFIX}:${ownerId}`;
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberRecord(value: unknown): value is Record<number, number> {
  return (
    isObject(value) &&
    Object.values(value).every((item) => isFiniteNumber(item))
  );
}

function isEntityPatch(value: unknown) {
  return (
    isObject(value) &&
    (value.entity_type === "customer" ||
      value.entity_type === "supplier" ||
      value.entity_type === "product") &&
    (typeof value.raw === "string" || value.raw === null) &&
    typeof value.resolved_id === "string" &&
    value.resolved_id.length > 0 &&
    typeof value.resolved_name === "string" &&
    value.resolved_name.length > 0
  );
}

function isEntityPatchRecord(value: unknown) {
  return isObject(value) && Object.values(value).every(isEntityPatch);
}

function isAddedItem(value: unknown) {
  return (
    isObject(value) &&
    typeof value.tempId === "string" &&
    value.tempId.length > 0 &&
    typeof value.product_id === "string" &&
    value.product_id.length > 0 &&
    typeof value.product_name === "string" &&
    value.product_name.length > 0 &&
    typeof value.unit === "string" &&
    isFiniteNumber(value.quantity) &&
    isFiniteNumber(value.unit_price)
  );
}

function parsePatched(value: unknown): PreviewCardPatch | null {
  if (!isObject(value)) {
    return null;
  }

  const removedIndices = value.removedIndices ?? [];
  const itemsAdded = value.itemsAdded ?? [];

  if (
    !isNumberRecord(value.itemPrices) ||
    !isNumberRecord(value.itemQuantities) ||
    !(isFiniteNumber(value.amount) || value.amount === null) ||
    !(isEntityPatch(value.customer) || value.customer === null) ||
    !(isEntityPatch(value.supplier) || value.supplier === null) ||
    !isEntityPatchRecord(value.itemProducts) ||
    !Array.isArray(removedIndices) ||
    !removedIndices.every((item) => Number.isInteger(item) && item >= 0) ||
    !Array.isArray(itemsAdded) ||
    !itemsAdded.every(isAddedItem)
  ) {
    return null;
  }

  return {
    itemPrices: value.itemPrices,
    itemQuantities: value.itemQuantities,
    amount: value.amount,
    customer: value.customer,
    supplier: value.supplier,
    itemProducts: value.itemProducts,
    removedIndices,
    itemsAdded,
  } as PreviewCardPatch;
}

function savedDateVN(savedAt: string) {
  const parsed = dayjs(savedAt);

  if (!parsed.isValid()) {
    return null;
  }

  return parsed.tz(APP_TIME_ZONE).format("YYYY-MM-DD");
}

function parseDraft(ownerId: string, value: unknown): PreviewDraft | null {
  if (!isObject(value)) {
    return null;
  }

  if (
    value.schemaVersion !== PREVIEW_DRAFT_SCHEMA_VERSION ||
    value.kind !== "preview_draft" ||
    value.ownerId !== ownerId ||
    typeof value.savedAt !== "string" ||
    typeof value.businessDate !== "string" ||
    typeof value.intent !== "string" ||
    !WRITABLE_DRAFT_INTENTS.has(value.intent) ||
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length === 0
  ) {
    return null;
  }

  const today = businessDateVN();

  if (value.businessDate !== today || savedDateVN(value.savedAt) !== today) {
    return null;
  }

  const resolved = ResolvedIntentSchema.safeParse(value.resolved);
  const patched = parsePatched(value.patched);

  if (!resolved.success || !patched || resolved.data.intent !== value.intent) {
    return null;
  }

  return {
    schemaVersion: PREVIEW_DRAFT_SCHEMA_VERSION,
    kind: "preview_draft",
    savedAt: value.savedAt,
    businessDate: value.businessDate,
    ownerId,
    intent: value.intent as PreviewDraftIntent,
    idempotencyKey: value.idempotencyKey,
    resolved: resolved.data,
    patched,
  };
}

export function saveDraft(ownerId: string, input: SavePreviewDraftInput) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const savedAt = dayjs().tz(APP_TIME_ZONE).format();
  const draft: PreviewDraft = {
    schemaVersion: PREVIEW_DRAFT_SCHEMA_VERSION,
    kind: "preview_draft",
    savedAt,
    businessDate: businessDateVN(),
    ownerId,
    intent: input.intent,
    idempotencyKey: input.idempotencyKey,
    resolved: input.resolved,
    patched: input.patched,
  };

  try {
    storage.setItem(draftKey(ownerId), JSON.stringify(draft));
  } catch {
    // localStorage can be unavailable or quota-limited; drafts are best-effort.
  }
}

export function clearDraft(ownerId: string) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(draftKey(ownerId));
  } catch {
    // Best-effort cleanup only.
  }
}

export function loadDraft(ownerId: string): PreviewDraft | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  let raw: string | null = null;

  try {
    raw = storage.getItem(draftKey(ownerId));
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = parseDraft(ownerId, JSON.parse(raw));

    if (!parsed) {
      clearDraft(ownerId);
    }

    return parsed;
  } catch {
    clearDraft(ownerId);
    return null;
  }
}
