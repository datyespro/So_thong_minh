"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Info, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import {
  commitOrder,
  commitPayment,
  commitPurchase,
  createCustomer,
  createSupplier,
  createProduct,
  createProductFromChat,
  deleteProduct,
  getCustomerDebt,
  persistDismissedPreviewMessage,
  persistProductManagementMessage,
  recreateSaleOrder,
  searchCustomersByName,
  searchSuppliersByName,
  searchProductsByName,
  undoCommit,
  updateProduct,
  type CommitOrderItemInput,
  type CommitPurchaseItemInput,
  type CreatedSupplierView,
  type CreatedProductView,
  type UndoTarget,
} from "@/app/(app)/chat/actions";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { HistoryCommitCard } from "@/src/components/chat/history-commit-card";
import {
  historyProductCardContent,
  type HistoryProductCard as HistoryProductCardData,
} from "@/src/lib/chat/history-card";
import { confirmAliasInBackground } from "@/src/components/chat/preview-card/alias-client";
import {
  buildDismissedPreviewCardFromState,
  claimDismissPreview,
  type DismissedPreviewPayload,
} from "@/src/components/chat/preview-card/dismissed-preview-card";
import {
  formatVietnameseMoney,
  parseVietnameseNumber,
} from "@/src/components/chat/preview-card/number-utils";
import {
  commitConfirmationMessage,
  dismissedPreviewMessage,
  friendlyNoneMessage,
} from "@/src/lib/ai/terminal-text";
import { CapabilityChipRow } from "@/src/components/chat/capability-chip-row";
import {
  capabilityReply,
  detectCapabilityQuestion,
} from "@/src/lib/ai/capability-help";
import {
  addItem,
  getPatchedPreviewState,
  removeAddedItem,
  removeIndex,
  updateCustomerPatch,
  updateAmountPatch,
  updateAddedItemPrice,
  updateAddedItemQuantity,
  updateItemProductPatch,
  updateItemPricePatch,
  updateItemQuantityPatch,
  updateSupplierPatch,
  type PreviewDisplayItem,
  type VisibleIssue,
} from "@/src/components/chat/preview-card/preview-state";
import type {
  PreviewAddedItemPatch,
  PreviewCardPatch,
  PreviewResolvedEntityPatch,
  ProductManagementCandidate,
  ProductManagementPreview,
  ProductManagementProduct,
  ProductManagementTarget,
  ProductManagementUpdateAction,
} from "@/src/components/chat/preview-card/types";
import type {
  EntityCandidate,
  ResolvedEntity,
  ResolvedIntent,
  ResolvedItem,
} from "@/src/lib/ai/resolve-schema";
import type { QueryAnswer } from "@/src/lib/ai/answer-query";
import type { ActionResult } from "@/src/types/action-result";
import {
  ValidatedIntentSchema,
  type ValidatedIntent,
} from "@/src/lib/ai/validate-schema";
import { businessDateVN, dayjs } from "@/src/lib/dayjs";
import { parseProductSellPriceInput } from "@/src/lib/products/update";
import {
  clearDraft,
  saveDraft,
  type PreviewDraft,
  type PreviewDraftIntent,
} from "@/src/lib/chat/preview-draft";

type PreviewCardMode = "live" | "restored";

type PreviewCardProps = Readonly<{
  validated: ValidatedIntent;
  answer?: QueryAnswer | null;
  productManagementPreview?: ProductManagementPreview | null;
  terminalText?: string | null;
  aiTurnId?: string | null;
  patched: PreviewCardPatch;
  ownerId?: string;
  isLive: boolean;
  mode?: PreviewCardMode;
  onPatchChange: (patch: PreviewCardPatch) => void;
  onPickSample?: (text: string) => void;
  restoredDraft?: PreviewDraft | null;
  onRestoredDismiss?: (payload: DismissedPreviewPayload) => void;
}>;

type DraftInputs = {
  prices: Record<number, string>;
  quantities: Record<number, string>;
  amount: string;
};

type EntityTarget =
  | { type: "customer"; entity: ResolvedEntity }
  | { type: "supplier"; entity: ResolvedEntity }
  | { type: "product"; entity: ResolvedEntity; itemIndex: number };

type PreviewCardInteractionInput = Readonly<{
  intent: ValidatedIntent["intent"];
  isLive: boolean;
  hasCommitted: boolean;
  undone: boolean;
  isEditing: boolean;
  isResaving: boolean;
  canConfirm: boolean;
}>;

type CommittedInfo = Readonly<{
  id: string;
  message: string;
  business_date: string | null;
}>;

export function getPreviewCardInteractionFlags(input: PreviewCardInteractionInput) {
  const isReopeningSaleOrder =
    input.intent === "create_order" &&
    input.isEditing &&
    input.isLive &&
    input.hasCommitted &&
    !input.undone;
  const interactive = input.isLive && (!input.hasCommitted || isReopeningSaleOrder);
  const canEditCounterpartyAndProducts = interactive && !isReopeningSaleOrder;
  const canChangeCustomerInEdit = isReopeningSaleOrder && !input.isResaving;
  const canEditItemsInEdit = isReopeningSaleOrder && !input.isResaving;
  const canShowEditOrderButton =
    input.intent === "create_order" &&
    input.hasCommitted &&
    input.isLive &&
    !input.undone &&
    !input.isEditing;
  const canShowUndoButton =
    input.hasCommitted && input.isLive && !input.undone && !input.isEditing;
  const canShowResaveControls =
    input.intent === "create_order" &&
    input.hasCommitted &&
    input.isLive &&
    !input.undone &&
    input.isEditing;

  return {
    isReopeningSaleOrder,
    interactive,
    canEditCounterpartyAndProducts,
    canChangeCustomerInEdit,
    canEditItemsInEdit,
    canShowEditOrderButton,
    canShowUndoButton,
    canShowResaveControls,
    resaveDisabled: input.isResaving || !input.canConfirm,
  };
}

export function getPreviewBusinessDate(
  input: Readonly<{
    intent: ValidatedIntent["intent"];
    hasCommitted: boolean;
    committedBusinessDate?: string | null;
    validatedBusinessDate?: string | null;
  }>,
) {
  if (input.intent !== "create_order" && input.intent !== "create_purchase") {
    return null;
  }

  if (input.hasCommitted) {
    return input.committedBusinessDate ?? null;
  }

  return input.validatedBusinessDate ?? businessDateVN();
}

export function businessDateCommitInput(value?: string | null) {
  return value != null ? { business_date: value } : {};
}

export function formatPreviewBusinessDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY");
}

export function canRemoveOrderItem(itemCount: number) {
  return itemCount > 1;
}

export type OrderItemRemoveMode =
  | "disabled"
  | "remove-item"
  | "confirm-delete-order";

export function getOrderItemRemoveMode(
  input: Readonly<{
    itemCount: number;
    isReopeningSaleOrder: boolean;
  }>,
): OrderItemRemoveMode {
  if (canRemoveOrderItem(input.itemCount)) {
    return "remove-item";
  }

  if (input.itemCount === 1 && input.isReopeningSaleOrder) {
    return "confirm-delete-order";
  }

  return "disabled";
}

export function shouldKeepDeleteOrderConfirmOpen(
  input: Readonly<{
    kind: ValidatedIntent["kind"];
    intent: ValidatedIntent["intent"];
    isEditing: boolean;
    isLive: boolean;
    hasCommitted: boolean;
    undone: boolean;
    itemCount: number;
  }>,
) {
  const isReopeningSaleOrder =
    input.intent === "create_order" &&
    input.isEditing &&
    input.isLive &&
    input.hasCommitted &&
    !input.undone;

  return (
    input.kind === "writable" &&
    getOrderItemRemoveMode({
      itemCount: input.itemCount,
      isReopeningSaleOrder,
    }) === "confirm-delete-order"
  );
}

export function formatDeleteOrderSummary(
  input: Readonly<{
    customerName: string | null;
    total: number | null;
    firstItem?: Readonly<{
      name: string;
      quantity: number | null;
      unit: string | null;
    }> | null;
  }>,
) {
  const parts = [input.customerName ? `Đơn ${input.customerName}` : "Đơn này"];

  if (input.firstItem) {
    const quantity =
      input.firstItem.quantity === null
        ? null
        : `${input.firstItem.quantity}${input.firstItem.unit ? ` ${input.firstItem.unit}` : ""}`;

    parts.push(
      quantity
        ? `${quantity} ${input.firstItem.name}`
        : input.firstItem.name,
    );
  }

  parts.push(
    input.total === null ? "Chưa rõ tổng tiền" : formatVietnameseMoney(input.total),
  );

  return parts.join(" - ");
}

function makeAddedItemTempId() {
  return `added-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

const PRODUCT_UNIT_SUGGESTIONS = ["bao", "cây", "cái", "m³"] as const;

export function addedItemFromProductCandidate(
  candidate: EntityCandidate,
  tempId: string,
): PreviewAddedItemPatch {
  return {
    tempId,
    product_id: candidate.id,
    product_name: candidate.name,
    unit: candidate.unit ?? "cái",
    quantity: 1,
    unit_price: candidate.sell_price ?? 0,
  };
}

export function addedItemFromCreatedProduct(
  product: CreatedProductView,
  tempId: string,
): PreviewAddedItemPatch {
  return {
    tempId,
    product_id: product.id,
    product_name: product.name,
    unit: product.unit,
    quantity: 1,
    unit_price: product.sell_price ?? 0,
  };
}

type ProductManagementReadyPreview = Extract<
  ProductManagementPreview,
  { status: "ready" }
>;
type ProductManagementSavedPreview = Extract<
  ProductManagementPreview,
  { status: "saved" }
>;
type ProductManagementCreateDraftPreview = Extract<
  ProductManagementPreview,
  { status: "create_draft" }
>;
type ProductManagementCreatedPreview = Extract<
  ProductManagementPreview,
  { status: "created" }
>;
type ProductManagementCreateDuplicatePreview = Extract<
  ProductManagementPreview,
  { status: "create_duplicate" }
>;
type ProductManagementUpdatePreview = Extract<
  ProductManagementPreview,
  { action: ProductManagementUpdateAction }
>;
type ProductManagementConfirmDeletePreview = Extract<
  ProductManagementPreview,
  { status: "confirm_delete" }
>;
type ProductManagementDeletedPreview = Extract<
  ProductManagementPreview,
  { status: "deleted" }
>;
type ProductManagementDeletePreview = Extract<
  ProductManagementPreview,
  { action: "delete" }
>;
type ProductManagementCreateFormState = {
  name: string;
  unit: string;
  sellPriceInput: string;
};
type ProductManagementCreatePayload = {
  name: string;
  unit: string;
  sell_price: number | null;
};

function productManagementTitle(action: ProductManagementUpdateAction) {
  return action === "set_unit" ? "Đổi đơn vị hàng" : "Đặt giá bán";
}

function formatProductManagementPrice(value: number | null) {
  return value === null ? "—" : formatVietnameseMoney(value);
}

type ProductManagementPersistedResult = Extract<
  ProductManagementPreview,
  { status: "created" | "saved" | "deleted" }
>;

export function historyProductCardFromResult(
  preview: ProductManagementPersistedResult,
): HistoryProductCardData {
  if (preview.status === "created") {
    return {
      v: 1,
      kind: "manage_product",
      action: "create",
      status: "created",
      product_name: preview.product.name,
      product_raw: null,
      unit: preview.product.unit,
      sell_price: preview.product.sell_price,
    };
  }

  if (preview.status === "deleted") {
    return {
      v: 1,
      kind: "manage_product",
      action: "delete",
      status: "deleted",
      product_name: preview.product.name,
      product_raw: null,
      unit: preview.product.unit,
      sell_price: preview.product.sell_price,
    };
  }

  const unit =
    preview.action === "set_unit"
      ? targetUnit(preview)
      : preview.product.unit;
  const sellPrice =
    preview.action === "set_price"
      ? targetSellPrice(preview)
      : preview.product.sell_price;

  return {
    v: 1,
    kind: "manage_product",
    action: preview.action,
    status: "saved",
    product_name: preview.product.name,
    product_raw: null,
    unit,
    sell_price: sellPrice,
  };
}

export function historyProductCardFromDismissedPreview(
  preview: ProductManagementPreview,
): HistoryProductCardData | null {
  if (preview.status === "create_draft") {
    return {
      v: 1,
      kind: "manage_product",
      action: "create",
      status: "dismissed",
      product_name: preview.draft.name,
      product_raw: preview.product_raw,
      unit: preview.draft.unit,
      sell_price: preview.draft.sell_price,
    };
  }

  if (preview.status === "ready") {
    return {
      v: 1,
      kind: "manage_product",
      action: preview.action,
      status: "dismissed",
      product_name: preview.product.name,
      product_raw: null,
      unit:
        preview.action === "set_unit"
          ? targetUnit(preview)
          : preview.product.unit,
      sell_price:
        preview.action === "set_price"
          ? targetSellPrice(preview)
          : preview.product.sell_price,
    };
  }

  if (preview.status === "confirm_delete") {
    return {
      v: 1,
      kind: "manage_product",
      action: "delete",
      status: "dismissed",
      product_name: preview.product.name,
      product_raw: null,
      unit: preview.product.unit,
      sell_price: preview.product.sell_price,
    };
  }

  return null;
}

export async function persistProductManagementHistory(
  card: HistoryProductCardData,
) {
  try {
    const result = await persistProductManagementMessage({
      card,
      content: historyProductCardContent(card),
    });

    if (!result.ok) {
      console.warn("Failed to persist product-management history card", {
        code: result.code,
        message: result.message,
      });
    }
  } catch (error) {
    console.warn("Failed to persist product-management history card", error);
  }
}

function targetUnit(preview: { target: ProductManagementTarget }) {
  return "unit" in preview.target && typeof preview.target.unit === "string"
    ? preview.target.unit
    : null;
}

function targetSellPrice(preview: { target: ProductManagementTarget }) {
  return "sell_price" in preview.target &&
    typeof preview.target.sell_price === "number"
    ? preview.target.sell_price
    : null;
}

export function productManagementProductFromCandidate(
  candidate: ProductManagementCandidate,
): ProductManagementProduct {
  return {
    id: candidate.id,
    name: candidate.name,
    unit: candidate.unit ?? null,
    sell_price: candidate.sell_price ?? null,
  };
}

export function productManagementChoiceEntity(
  preview: Extract<ProductManagementPreview, { status: "needs_choice" }>,
): ResolvedEntity {
  return {
    raw: preview.product_raw,
    entity_type: "product",
    status: "ambiguous",
    resolved_id: null,
    resolved_name: null,
    confidence: preview.candidates[0]?.score ?? 0,
    candidates: preview.candidates,
  };
}

export async function saveProductManagementPreview(
  preview: ProductManagementReadyPreview,
): Promise<
  | { ok: true; data: ProductManagementSavedPreview }
  | { ok: false; message: string }
> {
  const result =
    preview.action === "set_unit"
      ? await updateProduct(preview.product.id, {
          unit: targetUnit(preview) ?? "",
        })
      : await updateProduct(preview.product.id, {
          sell_price: targetSellPrice(preview),
        });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    data: {
      status: "saved",
      action: preview.action,
      product: preview.product,
      target: preview.target,
    },
  };
}

export async function saveProductManagementDeletePreview(
  preview: ProductManagementConfirmDeletePreview,
): Promise<
  | { ok: true; data: ProductManagementDeletedPreview }
  | { ok: false; message: string }
> {
  const result = await deleteProduct(preview.product.id);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    data: {
      status: "deleted",
      action: "delete",
      product: result.data,
    },
  };
}

export function productManagementCreateFormFromPreview(
  preview: ProductManagementCreateDraftPreview,
): ProductManagementCreateFormState {
  return {
    name: preview.draft.name,
    unit: preview.draft.unit || "cái",
    sellPriceInput:
      preview.draft.sell_price === null ? "" : String(preview.draft.sell_price),
  };
}

export function validateProductManagementCreateForm(
  input: ProductManagementCreateFormState,
):
  | { ok: true; data: ProductManagementCreatePayload }
  | { ok: false; message: string } {
  const name = input.name.trim();

  if (!name) {
    return { ok: false, message: "Tên hàng bắt buộc" };
  }

  const unit = input.unit.trim();

  if (!unit) {
    return { ok: false, message: "Đơn vị bắt buộc" };
  }

  const parsedPrice = parseProductSellPriceInput(input.sellPriceInput);

  if (!parsedPrice.ok) {
    return { ok: false, message: parsedPrice.message };
  }

  return {
    ok: true,
    data: {
      name,
      unit,
      sell_price: parsedPrice.value,
    },
  };
}

export async function saveProductManagementCreatePreview(
  input: ProductManagementCreateFormState,
): Promise<
  | { ok: true; data: ProductManagementCreatedPreview }
  | { ok: false; message: string }
> {
  const validated = validateProductManagementCreateForm(input);

  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  const result = await createProductFromChat(validated.data);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return {
    ok: true,
    data: {
      status: "created",
      action: "create",
      product: {
        id: result.data.id,
        name: result.data.name,
        unit: result.data.unit,
        sell_price: result.data.sell_price,
      },
    },
  };
}

const TITLE_BY_INTENT: Record<string, string> = {
  create_order: "Đơn bán hàng",
  create_purchase: "Đơn nhập hàng",
  record_payment: "Thu / trả nợ",
};

const BUTTON_BY_INTENT: Record<string, string> = {
  create_order: "Ghi đơn",
  create_purchase: "Ghi nhập hàng",
  record_payment: "Ghi thu nợ",
};

function compactFeatureText(intent: ValidatedIntent["intent"]) {
  if (intent === "edit_order" || intent === "undo") {
    return "Tính năng này sẽ có ở bước sau ạ.";
  }

  return "Phần trả lời sẽ có ở bước sau ạ.";
}

function formatAnswerDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function formatInventoryStock(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function QueryAnswerContent({
  answer,
}: Readonly<{
  answer: QueryAnswer | null | undefined;
}>) {
  if (!answer) {
    return null;
  }

  if (answer.state === "read_error") {
    return <p className="mt-2 text-textMute">{answer.message}</p>;
  }

  if (answer.type === "debt") {
    if (answer.state === "found") {
      if (answer.debt <= 0) {
        return (
          <p className="mt-2 font-semibold text-inkDeep">
            {answer.customerName} không còn nợ ạ.
          </p>
        );
      }

      const details = [
        formatAnswerDate(answer.lastOrderAt)
          ? `Đơn gần nhất ${formatAnswerDate(answer.lastOrderAt)}`
          : null,
        formatAnswerDate(answer.lastPaymentAt)
          ? `Trả gần nhất ${formatAnswerDate(answer.lastPaymentAt)}`
          : null,
      ].filter((detail): detail is string => Boolean(detail));

      return (
        <div className="mt-2">
          <p className="font-semibold text-inkDeep">
            {answer.customerName} đang nợ{" "}
            <span className="font-display text-2xl font-semibold tracking-normal text-debt">
              {formatVietnameseMoney(answer.debt)}
            </span>
          </p>
          {details.length > 0 ? (
            <p className="mt-1 text-[14px] leading-5 text-textMute">
              {details.join(" · ")}
            </p>
          ) : null}
        </div>
      );
    }

    if (answer.state === "ambiguous") {
      const names =
        answer.candidates.length > 0
          ? answer.candidates.join(", ")
          : "các tên gần giống trong sổ";

      return (
        <p className="mt-2 text-textMute">
          Em chưa chắc bác hỏi ai: {names}. Bác nhắn rõ tên giúp em ạ.
        </p>
      );
    }

    return (
      <p className="mt-2 text-textMute">
        Em chưa thấy khách tên &quot;{answer.askedName}&quot; trong sổ ạ.
      </p>
    );
  }

  if (answer.type === "inventory") {
    if (answer.state === "found") {
      if (answer.stock === 0) {
        return (
          <p className="mt-2 font-semibold text-inkDeep">
            {answer.productName} hết hàng rồi ạ.
          </p>
        );
      }

      if (answer.stock < 0) {
        return (
          <p className="mt-2 font-semibold text-inkDeep">
            {answer.productName} đang âm {formatInventoryStock(Math.abs(answer.stock))}{" "}
            {answer.unit} (đã bán quá tồn) ạ.
          </p>
        );
      }

      return (
        <p className="mt-2 font-semibold text-inkDeep">
          Còn{" "}
          <span className="font-display text-2xl font-semibold tracking-normal text-paid">
            {formatInventoryStock(answer.stock)} {answer.unit}
          </span>{" "}
          {answer.productName}
        </p>
      );
    }

    if (answer.state === "ambiguous") {
      const names =
        answer.candidates.length > 0
          ? answer.candidates.join(", ")
          : "các hàng gần giống trong sổ";

      return (
        <p className="mt-2 text-textMute">
          Em chưa chắc bác hỏi hàng nào: {names}. Bác nói rõ tên giúp em ạ.
        </p>
      );
    }

    return (
      <p className="mt-2 text-textMute">
        Em chưa thấy hàng &quot;{answer.askedName}&quot; trong sổ ạ.
      </p>
    );
  }

  if (answer.state === "unsupported_range") {
    return (
      <p className="mt-2 text-textMute">
        Khúc thời gian này em chưa tra được, bác hỏi giúp em theo{" "}
        <em>hôm nay / hôm qua / tuần này / tháng này</em> nhé.
      </p>
    );
  }

  if (answer.orders <= 0) {
    return (
      <p className="mt-2 font-semibold text-inkDeep">
        {answer.rangeLabel} chưa bán đơn nào ạ.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="font-semibold text-inkDeep">
        {answer.rangeLabel}: {answer.orders} đơn ·{" "}
        <span className="font-display text-2xl font-semibold tracking-normal text-paid">
          {formatVietnameseMoney(answer.revenue)}
        </span>
      </p>
      <p className="mt-1 text-[14px] leading-5 text-textMute">
        Đã thu {formatVietnameseMoney(answer.paid)} · Nợ thêm{" "}
        {formatVietnameseMoney(answer.debt)}
      </p>
    </div>
  );
}

function counterpartyLabel(validated: ValidatedIntent) {
  return validated.intent === "create_purchase" ? "Nhà cung cấp" : "Khách";
}

function unresolvedCounterpartyText(validated: ValidatedIntent) {
  if (validated.intent === "create_purchase") {
    return "Chưa rõ nhập từ ai";
  }

  return validated.intent === "record_payment"
    ? "Chưa rõ khách nào"
    : "Chưa rõ bán cho ai";
}

function counterpartyEntity(
  validated: ValidatedIntent,
  state: ReturnType<typeof getPatchedPreviewState>,
) {
  return validated.intent === "create_purchase" ? state.supplier : state.customer;
}

function counterpartyName(entity: ResolvedEntity | null) {
  if (entity?.status === "resolved" && entity.resolved_name) {
    return entity.resolved_name;
  }

  return null;
}

export function entityPatchFromCandidate(
  entity: ResolvedEntity,
  candidate: EntityCandidate,
): PreviewResolvedEntityPatch {
  return {
    entity_type: entity.entity_type,
    raw: entity.raw,
    resolved_id: candidate.id,
    resolved_name: candidate.name,
  };
}

export function entityPatchFromCreatedCustomer(
  raw: string,
  customer: { id: string; name: string },
): PreviewResolvedEntityPatch {
  return {
    entity_type: "customer",
    raw,
    resolved_id: customer.id,
    resolved_name: customer.name,
  };
}

export function entityPatchFromCreatedSupplier(
  raw: string,
  supplier: CreatedSupplierView,
): PreviewResolvedEntityPatch {
  return {
    entity_type: "supplier",
    raw,
    resolved_id: supplier.id,
    resolved_name: supplier.name,
  };
}

export function entityPatchFromCreatedProduct(
  raw: string,
  product: CreatedProductView,
): PreviewResolvedEntityPatch {
  return {
    entity_type: "product",
    raw,
    resolved_id: product.id,
    resolved_name: product.name,
  };
}

type CreateProductForItemAction = (
  name: string,
  unit: string,
  sellPrice: number | null,
) => Promise<ActionResult<CreatedProductView>>;

export async function createProductPatchForItem(
  input: Readonly<{
    patch: PreviewCardPatch;
    itemIndex: number;
    rawName: string;
    draft: { unit: string; sell_price: number | null };
  }>,
  createProductAction: CreateProductForItemAction = createProduct,
) {
  const name = input.rawName.trim();

  if (!name) {
    return {
      ok: false as const,
      message: "Chưa thêm được mặt hàng, bác thử lại ạ.",
    };
  }

  const result = await createProductAction(
    name,
    input.draft.unit,
    input.draft.sell_price,
  );

  if (!result.ok) {
    return {
      ok: false as const,
      message: "Chưa thêm được mặt hàng, bác thử lại ạ.",
    };
  }

  return {
    ok: true as const,
    patch: updateItemProductPatch(
      input.patch,
      input.itemIndex,
      entityPatchFromCreatedProduct(name, result.data),
    ),
  };
}

function shouldLearnAlias(raw: string | null, resolvedName: string) {
  if (!raw) {
    return false;
  }

  return raw.trim().toLocaleLowerCase("vi-VN") !== resolvedName.trim().toLocaleLowerCase("vi-VN");
}

// One stable key per card instance. Re-clicking "Ghi đơn" reuses it, so a
// double-submit hits the DB idempotency guard instead of writing twice.
function makeIdempotencyKey() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Non-secure context — fall back below.
  }

  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isPreviewDraftIntent(intent: ValidatedIntent["intent"]): intent is PreviewDraftIntent {
  return (
    intent === "create_order" ||
    intent === "record_payment" ||
    intent === "create_purchase"
  );
}

function resolvedEntityFromPatch(
  entity: ResolvedEntity | null,
  patch: PreviewResolvedEntityPatch | null,
) {
  if (!patch) {
    return entity;
  }

  return {
    raw: patch.raw,
    entity_type: patch.entity_type,
    status: "resolved" as const,
    resolved_id: patch.resolved_id,
    resolved_name: patch.resolved_name,
    confidence: 1,
    candidates: [],
  };
}

function resolvedItemFromValidated(
  item: ValidatedIntent["items"][number],
  itemIndex: number,
  patch: PreviewCardPatch,
): ResolvedItem {
  return {
    raw: item.raw,
    product_name: item.product_name,
    quantity: patch.itemQuantities[itemIndex] ?? item.quantity,
    unit: item.unit,
    unit_price: patch.itemPrices[itemIndex] ?? item.unit_price,
    line_total: item.line_total,
    confidence: item.confidence,
    resolution:
      resolvedEntityFromPatch(item.resolution, patch.itemProducts[itemIndex] ?? null) ??
      item.resolution,
  };
}

function statusForResolvedIntent(resolved: Pick<ResolvedIntent, "customer" | "supplier" | "items">) {
  const entities = [
    resolved.customer,
    resolved.supplier,
    ...resolved.items.map((item) => item.resolution),
  ].filter((entity): entity is ResolvedEntity => entity !== null);

  if (entities.every((entity) => entity.status === "resolved")) {
    return "all_resolved" as const;
  }

  if (
    entities.some(
      (entity) =>
        entity.status === "needs_confirmation" || entity.status === "ambiguous",
    )
  ) {
    return "needs_confirmation" as const;
  }

  return "has_unresolved" as const;
}

export function resolvedIntentForPreviewDraft(
  validated: ValidatedIntent,
  patch: PreviewCardPatch,
): ResolvedIntent | null {
  if (!isPreviewDraftIntent(validated.intent)) {
    return null;
  }

  const resolved: ResolvedIntent = {
    intent: validated.intent,
    raw_text: validated.raw_text,
    ...businessDateCommitInput(validated.business_date),
    amount:
      validated.intent === "record_payment"
        ? patch.amount ?? validated.effective_amount
        : null,
    payment_status: "unknown",
    payment_method: null,
    customer: resolvedEntityFromPatch(validated.customer, patch.customer),
    supplier: resolvedEntityFromPatch(validated.supplier, patch.supplier),
    items: validated.items.map((item, index) =>
      resolvedItemFromValidated(item, index, patch),
    ),
    overall_status: "has_unresolved",
    needs_confirmation: false,
  };

  const overallStatus = statusForResolvedIntent(resolved);

  return {
    ...resolved,
    overall_status: overallStatus,
    needs_confirmation: overallStatus === "needs_confirmation",
  };
}

function isStateResolvedForDraft(
  intent: PreviewDraftIntent,
  state: ReturnType<typeof getPatchedPreviewState>,
) {
  if (
    (intent === "create_order" || intent === "record_payment") &&
    state.customer?.status !== "resolved"
  ) {
    return false;
  }

  if (
    intent === "create_purchase" &&
    state.supplier !== null &&
    state.supplier.status !== "resolved"
  ) {
    return false;
  }

  return state.items.every((item) => item.resolution.status === "resolved");
}

function saveCurrentPreviewDraft(input: Readonly<{
  ownerId: string | undefined;
  validated: ValidatedIntent;
  patched: PreviewCardPatch;
  state: ReturnType<typeof getPatchedPreviewState>;
  idempotencyKey: string;
}>) {
  if (!input.ownerId || !isPreviewDraftIntent(input.validated.intent)) {
    return;
  }

  if (!isStateResolvedForDraft(input.validated.intent, input.state)) {
    return;
  }

  const resolved = resolvedIntentForPreviewDraft(input.validated, input.patched);

  if (!resolved) {
    return;
  }

  saveDraft(input.ownerId, {
    intent: input.validated.intent,
    idempotencyKey: input.idempotencyKey,
    resolved,
    patched: input.patched,
  });
}

function entityNameForState(
  intent: PreviewDraftIntent,
  state: ReturnType<typeof getPatchedPreviewState>,
) {
  const entity = intent === "create_purchase" ? state.supplier : state.customer;

  return counterpartyName(entity);
}

function restoredOrderItems(
  state: ReturnType<typeof getPatchedPreviewState>,
): CommitOrderItemInput[] | null {
  const items: CommitOrderItemInput[] = [];

  for (const displayItem of state.items) {
    const productId = displayItem.resolution.resolved_id;

    if (
      !productId ||
      displayItem.quantity === null ||
      displayItem.unitPrice === null
    ) {
      return null;
    }

    items.push({
      product_id: productId,
      product_name_snapshot: displayItem.name,
      unit_snapshot: displayItem.unit,
      quantity: displayItem.quantity,
      unit_price: displayItem.unitPrice,
    });
  }

  return items;
}

function restoredPurchaseItems(
  state: ReturnType<typeof getPatchedPreviewState>,
): CommitPurchaseItemInput[] | null {
  const items: CommitPurchaseItemInput[] = [];

  for (const displayItem of state.items) {
    const productId = displayItem.resolution.resolved_id;

    if (
      !productId ||
      displayItem.quantity === null ||
      displayItem.unitPrice === null
    ) {
      return null;
    }

    items.push({
      product_id: productId,
      product_name_snapshot: displayItem.name,
      unit_snapshot: displayItem.unit,
      quantity: displayItem.quantity,
      unit_cost: displayItem.unitPrice,
    });
  }

  return items;
}

type RestoredDraftCommitResult =
  | {
      ok: true;
      validated: ValidatedIntent;
      committedInfo: CommittedInfo;
    }
  | {
      ok: false;
      message: string;
      validated?: ValidatedIntent;
    };

async function validateRestoredDraft(draft: PreviewDraft) {
  const response = await fetch("/api/ai/validate-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved: draft.resolved }),
  });
  const body = await response.json() as {
    ok?: boolean;
    data?: unknown;
    message?: string;
  };

  if (!response.ok || body.ok !== true) {
    return {
      ok: false as const,
      message: body.message ?? "Chưa kiểm được nháp, bác thử lại ạ.",
    };
  }

  const parsed = ValidatedIntentSchema.safeParse(body.data);

  if (!parsed.success || parsed.data.intent !== draft.intent) {
    return {
      ok: false as const,
      message: "Nháp không còn đúng dạng để ghi, bác bỏ nháp rồi tạo lại giúp em ạ.",
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function commitRestoredPreviewDraft(
  draft: PreviewDraft,
): Promise<RestoredDraftCommitResult> {
  clearDraft(draft.ownerId);

  try {
    const validation = await validateRestoredDraft(draft);

    if (!validation.ok) {
      saveDraft(draft.ownerId, draft);
      return { ok: false, message: validation.message };
    }

    const validated = validation.data;
    const state = getPatchedPreviewState(validated, draft.patched);

    if (!state.canConfirm) {
      saveDraft(draft.ownerId, draft);
      return {
        ok: false,
        validated,
        message: "Nháp còn thiếu thông tin, bác kiểm tra rồi tạo lại giúp em ạ.",
      };
    }

    if (draft.intent === "create_order") {
      const customerId = state.customer?.resolved_id ?? null;
      const items = restoredOrderItems(state);

      if (!customerId || !items) {
        saveDraft(draft.ownerId, draft);
        return {
          ok: false,
          validated,
          message: "Đơn còn thiếu thông tin, bác kiểm tra rồi tạo lại giúp em ạ.",
        };
      }

      const entityName = entityNameForState(draft.intent, state);
      const result = await commitOrder({
        idempotency_key: draft.idempotencyKey,
        customer_id: customerId,
        customer_name: entityName,
        raw_input: validated.raw_text,
        ...businessDateCommitInput(validated.business_date),
        items,
      });

      if (!result.ok) {
        saveDraft(draft.ownerId, draft);
        return { ok: false, validated, message: result.message };
      }

      return {
        ok: true,
        validated,
        committedInfo: {
          id: result.data.order_id,
          business_date: result.data.business_date,
          message: commitConfirmationMessage({
            type: "create_order",
            entityName,
          }),
        },
      };
    }

    if (draft.intent === "record_payment") {
      const customerId = state.customer?.resolved_id ?? null;
      const amount = state.amount;

      if (!customerId || amount === null || !(amount > 0)) {
        saveDraft(draft.ownerId, draft);
        return {
          ok: false,
          validated,
          message: "Phiếu thu còn thiếu thông tin, bác kiểm tra rồi tạo lại giúp em ạ.",
        };
      }

      const entityName = entityNameForState(draft.intent, state);
      const result = await commitPayment({
        idempotency_key: draft.idempotencyKey,
        customer_id: customerId,
        customer_name: entityName,
        amount,
        raw_input: validated.raw_text,
      });

      if (!result.ok) {
        saveDraft(draft.ownerId, draft);
        return { ok: false, validated, message: result.message };
      }

      return {
        ok: true,
        validated,
        committedInfo: {
          id: result.data.payment_id,
          business_date: null,
          message: commitConfirmationMessage({
            type: "record_payment",
            entityName,
          }),
        },
      };
    }

    const items = restoredPurchaseItems(state);

    if (!items) {
      saveDraft(draft.ownerId, draft);
      return {
        ok: false,
        validated,
        message: "Đơn nhập còn thiếu thông tin, bác kiểm tra rồi tạo lại giúp em ạ.",
      };
    }

    const supplierName = entityNameForState(draft.intent, state);
    const result = await commitPurchase({
      idempotency_key: draft.idempotencyKey,
      supplier_id: state.supplier?.resolved_id ?? null,
      supplier_name: supplierName,
      raw_input: validated.raw_text,
      ...businessDateCommitInput(validated.business_date),
      items,
    });

    if (!result.ok) {
      saveDraft(draft.ownerId, draft);
      return { ok: false, validated, message: result.message };
    }

    return {
      ok: true,
      validated,
      committedInfo: {
        id: result.data.purchase_id,
        business_date: result.data.business_date,
        message: commitConfirmationMessage({
          type: "create_purchase",
          supplierName,
        }),
      },
    };
  } catch {
    saveDraft(draft.ownerId, draft);
    return {
      ok: false,
      message: "Chưa ghi được nháp, bác thử lại ạ.",
    };
  }
}

function issueGroups(issues: VisibleIssue[]) {
  return {
    blocking: issues.filter((issue) => issue.severity === "blocking"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info"),
  };
}

function IssuePanel({
  title,
  tone,
  issues,
}: Readonly<{
  title: string;
  tone: "blocking" | "warning" | "info";
  issues: VisibleIssue[];
}>) {
  if (issues.length === 0) {
    return null;
  }

  const Icon = tone === "blocking" ? TriangleAlert : tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "rounded border px-3 py-2 text-[15px] leading-6",
        tone === "blocking" && "border-debt/30 bg-red-50 text-debt",
        tone === "warning" && "border-stamp/25 bg-amber-50 text-stamp",
        tone === "info" && "border-ledgerBorder bg-paperWarm text-textMute",
      )}
      data-testid={`issue-panel-${tone}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.item_index ?? "order"}-${index}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PatchInput({
  label,
  placeholder,
  value,
  onChange,
}: Readonly<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain shadow-inner outline-none placeholder:text-textFaint focus:border-ink"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EntityChoicePanel({
  entity,
  label,
  allowCreate,
  createLabel = "khách",
  onSelect,
  onCreate,
}: Readonly<{
  entity: ResolvedEntity;
  label: string;
  allowCreate: boolean;
  createLabel?: string;
  onSelect: (candidate: EntityCandidate) => void;
  onCreate?: () => void;
}>) {
  const raw = entity.raw ?? "";
  const candidates = entity.candidates.slice(0, 3);

  if (candidates.length === 0 && !allowCreate) {
    return null;
  }

  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid={`${entity.entity_type}-confirm-panel`}
    >
      <p className="font-semibold text-inkDeep">
        {raw ? `${label} "${raw}" - có phải ý bác là...?` : "Bác chọn giúp em ạ."}
      </p>
      {candidates.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {candidates.map((candidate) => (
            <Button
              key={candidate.id}
              type="button"
              variant="outline"
              className="h-auto min-h-11 justify-start rounded border-ledgerBorder bg-surface px-3 py-2 text-left text-[16px] font-semibold text-inkDeep hover:bg-paperWarm"
              onClick={() => onSelect(candidate)}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {candidate.name}
            </Button>
          ))}
        </div>
      ) : null}
      {allowCreate && raw ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-auto min-h-10 justify-start px-0 text-[15px] font-semibold text-stamp hover:bg-transparent hover:text-ink"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Không phải, thêm {createLabel} mới: &quot;{raw}&quot;
        </Button>
      ) : null}
    </div>
  );
}

function CustomerCreatePanel({
  raw,
  isSaving,
  error,
  onCreate,
  onDismiss,
}: Readonly<{
  raw: string;
  isSaving: boolean;
  error: string | null;
  onCreate: () => void;
  onDismiss: () => void;
}>) {
  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid="customer-create-panel"
    >
      <p className="font-semibold text-inkDeep">
        Chưa có khách &quot;{raw}&quot;. Thêm mới nhé?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 rounded bg-ink px-3 text-[16px] font-semibold text-paper hover:bg-inkDeep"
          disabled={isSaving}
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Đang thêm..." : `Thêm ${raw}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded border-ledgerBorder bg-surface px-3 text-[16px] font-semibold text-textMute hover:bg-paperWarm"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Để sau
        </Button>
      </div>
      {error ? <p className="mt-2 text-[15px] text-debt">{error}</p> : null}
    </div>
  );
}

function SupplierCreatePanel({
  raw,
  isSaving,
  error,
  onCreate,
  onDismiss,
}: Readonly<{
  raw: string;
  isSaving: boolean;
  error: string | null;
  onCreate: () => void;
  onDismiss: () => void;
}>) {
  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid="supplier-create-panel"
    >
      <p className="font-semibold text-inkDeep">
        Chưa có nhà cung cấp &quot;{raw}&quot;. Thêm mới nhé?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 rounded bg-ink px-3 text-[16px] font-semibold text-paper hover:bg-inkDeep"
          disabled={isSaving}
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Đang thêm..." : `Thêm ${raw}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded border-ledgerBorder bg-surface px-3 text-[16px] font-semibold text-textMute hover:bg-paperWarm"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Để sau
        </Button>
      </div>
      {error ? <p className="mt-2 text-[15px] text-debt">{error}</p> : null}
    </div>
  );
}

export function ProductCreatePanel({
  raw,
  defaultUnit,
  defaultSellPrice,
  submitLabel,
  isSaving,
  error,
  onCreate,
  onDismiss,
  onDraftChange,
}: Readonly<{
  raw: string;
  defaultUnit?: string;
  defaultSellPrice?: number | null;
  submitLabel?: string;
  isSaving: boolean;
  error: string | null;
  onCreate: (draft: { unit: string; sell_price: number | null }) => void;
  onDismiss: () => void;
  onDraftChange: () => void;
}>) {
  const [unitDraft, setUnitDraft] = React.useState(
    defaultUnit === undefined ? "cái" : defaultUnit,
  );
  const [sellPriceDraft, setSellPriceDraft] = React.useState(
    defaultSellPrice == null ? "" : String(defaultSellPrice),
  );
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUnitDraft(defaultUnit === undefined ? "cái" : defaultUnit);
    setSellPriceDraft(defaultSellPrice == null ? "" : String(defaultSellPrice));
    setLocalError(null);
  }, [raw, defaultUnit, defaultSellPrice]);

  function handleDraftChange() {
    setLocalError(null);
    onDraftChange();
  }

  function handleCreateClick() {
    const unit = unitDraft.trim();

    if (!unit) {
      setLocalError("Chọn đơn vị");
      onDraftChange();
      return;
    }

    const parsedPrice = parseProductSellPriceInput(sellPriceDraft);

    if (!parsedPrice.ok) {
      setLocalError(parsedPrice.message);
      onDraftChange();
      return;
    }

    setLocalError(null);
    onCreate({ unit, sell_price: parsedPrice.value });
  }

  const visibleError = localError ?? error;

  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid="product-create-panel"
    >
      <p className="font-semibold text-inkDeep">
        Chưa có mặt hàng &quot;{raw}&quot;. Thêm mới nhé?
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
            Đơn vị
          </span>
          <input
            type="text"
            value={unitDraft}
            disabled={isSaving}
            className="mt-1 h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => {
              setUnitDraft(event.target.value);
              handleDraftChange();
            }}
          />
        </label>
        <label className="min-w-0">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
            Giá bán
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={sellPriceDraft}
            disabled={isSaving}
            placeholder="Để trống nếu chưa có"
            className="mt-1 h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) => {
              setSellPriceDraft(event.target.value);
              handleDraftChange();
            }}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRODUCT_UNIT_SUGGESTIONS.map((unit) => (
          <button
            key={unit}
            type="button"
            disabled={isSaving}
            className="h-9 rounded border border-stamp/30 bg-surface px-3 text-[15px] font-semibold text-ink hover:border-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              setUnitDraft(unit);
              handleDraftChange();
            }}
          >
            {unit}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 rounded bg-ink px-3 text-[16px] font-semibold text-paper hover:bg-inkDeep"
          disabled={isSaving}
          onClick={handleCreateClick}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Đang thêm..." : (submitLabel ?? `Thêm ${raw}`)}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded border-ledgerBorder bg-surface px-3 text-[16px] font-semibold text-textMute hover:bg-paperWarm"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Để sau
        </Button>
      </div>
      {visibleError ? (
        <p className="mt-2 text-[15px] text-debt" role="alert">
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}

function ProductMissingNotice({
  raw,
  onCreate,
}: Readonly<{ raw: string; onCreate: () => void }>) {
  return (
    <div
      className="mt-2 rounded border border-debt/25 bg-red-50 px-3 py-2 text-[15px] leading-6 text-debt"
      data-testid="product-not-found"
    >
      <p>Chưa có hàng &quot;{raw}&quot; trong sổ.</p>
      <Button
        type="button"
        variant="outline"
        className="mt-2 h-10 rounded border-debt/30 bg-surface px-3 text-[15px] font-semibold text-debt hover:bg-red-50"
        onClick={onCreate}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tạo hàng
      </Button>
    </div>
  );
}

function ProductManagementCreatePreviewContent({
  preview,
  isLive,
  isSaving,
  error,
  draft,
  onDraftChange,
  onSave,
  onCancel,
}: Readonly<{
  preview:
    | ProductManagementCreateDraftPreview
    | ProductManagementCreateDuplicatePreview
    | ProductManagementCreatedPreview;
  isLive: boolean;
  isSaving: boolean;
  error: string | null;
  draft: ProductManagementCreateFormState;
  onDraftChange: (
    field: keyof ProductManagementCreateFormState,
    value: string,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
}>) {
  const interactive = isLive && preview.status === "create_draft";

  return (
    <div className={cn("flex w-full justify-start", !interactive && "opacity-70")}>
      <article
        className={cn(
          "w-full max-w-[94%] rounded border px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]",
          interactive
            ? "border-ledgerBorder bg-surface"
            : "border-ledgerBorder bg-paperWarm shadow-none",
        )}
        data-testid={`product-management-${preview.status}`}
      >
        <div className="border-b border-ledgerBorder pb-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            manage_product
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
            {preview.status === "created"
              ? "Đã thêm hàng"
              : preview.status === "create_duplicate"
                ? "Hàng đã có"
                : "Thêm hàng mới"}
          </h2>
        </div>

        {preview.status === "create_duplicate" ? (
          <div
            className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3 text-[16px] leading-7"
            data-testid="product-management-create-duplicate"
          >
            <p className="font-semibold text-inkDeep">
              Hàng “{preview.product.name}” đã có trong danh sách.
            </p>
            <p className="mt-1 text-textMute">
              Bác có thể đổi đơn vị/giá của hàng này nếu cần.
            </p>
          </div>
        ) : preview.status === "created" ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <p
              className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-paid"
              data-testid="product-management-created"
            >
              <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
              Đã thêm hàng {preview.product.name}.
            </p>
            <div className="mt-3 grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Đơn vị</p>
              <p className="font-semibold text-inkDeep">
                {preview.product.unit ?? "—"}
              </p>
              <p className="font-semibold text-textMute">Giá bán</p>
              <p className="font-semibold text-inkDeep">
                {formatProductManagementPrice(preview.product.sell_price)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              <label className="min-w-0">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                  Tên hàng
                </span>
                <input
                  type="text"
                  value={draft.name}
                  disabled={!interactive || isSaving}
                  className="mt-1 h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                  onChange={(event) => onDraftChange("name", event.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                    Đơn vị
                  </span>
                  <input
                    type="text"
                    value={draft.unit}
                    disabled={!interactive || isSaving}
                    className="mt-1 h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                    onChange={(event) => onDraftChange("unit", event.target.value)}
                  />
                </label>
                <label className="min-w-0">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp">
                    Giá bán
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.sellPriceInput}
                    disabled={!interactive || isSaving}
                    placeholder="Để trống nếu chưa có"
                    className="mt-1 h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                    onChange={(event) =>
                      onDraftChange("sellPriceInput", event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRODUCT_UNIT_SUGGESTIONS.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    disabled={!interactive || isSaving}
                    className={cn(
                      "h-9 rounded border border-stamp/30 bg-surface px-3 text-[15px] font-semibold text-ink hover:border-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-60",
                      draft.unit.trim() === unit && "border-ink bg-paperWarm",
                    )}
                    onClick={() => onDraftChange("unit", unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-ledgerBorder pt-3">
              <Button
                type="button"
                disabled={!interactive || isSaving}
                className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                onClick={onSave}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {isSaving ? "Đang tạo..." : "Tạo hàng"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!interactive || isSaving}
                className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                onClick={onCancel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Hủy
              </Button>
            </div>
          </>
        )}

        {error ? (
          <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
            {error}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ProductManagementPreviewContent({
  preview,
  isLive,
  isSaving,
  error,
  onSelectCandidate,
  onSave,
  onCancel,
}: Readonly<{
  preview: ProductManagementUpdatePreview;
  isLive: boolean;
  isSaving: boolean;
  error: string | null;
  onSelectCandidate: (candidate: ProductManagementCandidate) => void;
  onSave: () => void;
  onCancel: () => void;
}>) {
  if (preview.status === "not_found") {
    return (
      <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
        <div
          className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]"
          data-testid="product-management-not-found"
        >
          Dạ, em chưa tìm thấy hàng “{preview.product_raw}” trong danh sách. Bác thêm hàng này trước rồi đổi đơn vị/giá sau nhé.
        </div>
      </div>
    );
  }

  const title = productManagementTitle(preview.action);
  const interactive = isLive && preview.status !== "saved";
  const product =
    preview.status === "ready" || preview.status === "saved"
      ? preview.product
      : null;
  const newUnit = "target" in preview ? targetUnit(preview) : null;
  const newSellPrice = "target" in preview ? targetSellPrice(preview) : null;

  return (
    <div className={cn("flex w-full justify-start", !interactive && "opacity-70")}>
      <article
        className={cn(
          "w-full max-w-[94%] rounded border px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]",
          interactive
            ? "border-ledgerBorder bg-surface"
            : "border-ledgerBorder bg-paperWarm shadow-none",
        )}
        data-testid={`product-management-${preview.status}`}
      >
        <div className="border-b border-ledgerBorder pb-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            manage_product
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
            {title}
          </h2>
        </div>

        {preview.status === "needs_choice" ? (
          <div className="mt-3">
            <p className="text-[16px] leading-7 text-textMute">
              Bác chọn đúng hàng cần sửa giúp em ạ.
            </p>
            <EntityChoicePanel
              entity={productManagementChoiceEntity(preview)}
              label="Hàng"
              allowCreate={false}
              onSelect={(candidate) =>
                onSelectCandidate(candidate as ProductManagementCandidate)
              }
            />
          </div>
        ) : null}

        {product ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Hàng</p>
              <p className="font-semibold text-inkDeep">{product.name}</p>
              {preview.action === "set_unit" ? (
                <>
                  <p className="font-semibold text-textMute">Từ</p>
                  <p className="font-semibold">{product.unit ?? "—"}</p>
                  <p className="font-semibold text-textMute">Thành</p>
                  <p className="font-semibold text-paid">{newUnit}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-textMute">Từ</p>
                  <p className="font-semibold">
                    {formatProductManagementPrice(product.sell_price)}
                  </p>
                  <p className="font-semibold text-textMute">Thành</p>
                  <p className="font-semibold text-paid">
                    {formatProductManagementPrice(newSellPrice)}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        {preview.status === "saved" && product ? (
          <p
            className="mt-4 flex items-center gap-2 border-t border-ledgerBorder pt-3 text-[16px] font-semibold leading-6 text-paid"
            data-testid="product-management-saved"
          >
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
            {preview.action === "set_unit"
              ? `Đã đổi đơn vị hàng ${product.name} thành ${newUnit}.`
              : `Đã đặt giá bán hàng ${product.name} thành ${formatProductManagementPrice(newSellPrice)}.`}
          </p>
        ) : null}

        {preview.status === "ready" && interactive ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ledgerBorder pt-3">
            <Button
              type="button"
              disabled={isSaving}
              className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onSave}
            >
              {isSaving ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onCancel}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Hủy
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
            {error}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ProductManagementDeletePreviewContent({
  preview,
  isLive,
  isSaving,
  isDismissed,
  error,
  onSelectCandidate,
  onSave,
  onCancel,
}: Readonly<{
  preview: ProductManagementDeletePreview;
  isLive: boolean;
  isSaving: boolean;
  isDismissed: boolean;
  error: string | null;
  onSelectCandidate: (candidate: ProductManagementCandidate) => void;
  onSave: () => void;
  onCancel: () => void;
}>) {
  if (preview.status === "not_found") {
    return (
      <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
        <div
          className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]"
          data-testid="product-management-delete-not-found"
        >
          Em chưa thấy hàng “{preview.product_raw}” trong danh sách ạ.
        </div>
      </div>
    );
  }

  const product =
    preview.status === "confirm_delete" || preview.status === "deleted"
      ? preview.product
      : null;
  const interactive =
    isLive && preview.status === "confirm_delete" && !isDismissed;

  return (
    <div className={cn("flex w-full justify-start", !interactive && "opacity-70")}>
      <article
        className={cn(
          "w-full max-w-[94%] rounded border px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]",
          interactive
            ? "border-ledgerBorder bg-surface"
            : "border-ledgerBorder bg-paperWarm shadow-none",
        )}
        data-testid={`product-management-${preview.status}`}
      >
        <div className="border-b border-ledgerBorder pb-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            manage_product
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
            {preview.status === "needs_choice"
              ? "Chọn hàng cần xóa"
              : "Xác nhận xóa hàng"}
          </h2>
        </div>

        {preview.status === "needs_choice" ? (
          <div className="mt-3">
            <p className="text-[16px] leading-7 text-textMute">
              Bác chọn đúng hàng cần xóa giúp em ạ.
            </p>
            <EntityChoicePanel
              entity={productManagementChoiceEntity(preview)}
              label="Hàng"
              allowCreate={false}
              onSelect={(candidate) =>
                onSelectCandidate(candidate as ProductManagementCandidate)
              }
            />
          </div>
        ) : null}

        {product ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Hàng</p>
              <p className="font-semibold text-inkDeep">{product.name}</p>
              <p className="font-semibold text-textMute">Đơn vị</p>
              <p className="font-semibold">{product.unit ?? "—"}</p>
              <p className="font-semibold text-textMute">Giá bán</p>
              <p className="font-semibold">
                {formatProductManagementPrice(product.sell_price)}
              </p>
            </div>
          </div>
        ) : null}

        {preview.status === "deleted" && product ? (
          <p
            className="mt-4 flex items-center gap-2 border-t border-ledgerBorder pt-3 text-[16px] font-semibold leading-6 text-paid"
            data-testid="product-management-deleted"
          >
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
            Đã xóa hàng {product.name} khỏi danh sách.
          </p>
        ) : null}

        {isDismissed ? (
          <p
            className="mt-4 border-t border-ledgerBorder pt-3 text-[16px] font-semibold leading-6 text-textMute"
            data-testid="product-management-delete-dismissed"
          >
            Đã bỏ, chưa lưu vào danh sách.
          </p>
        ) : null}

        {interactive ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ledgerBorder pt-3">
            <Button
              type="button"
              disabled={isSaving}
              className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onSave}
            >
              {isSaving ? "Đang xóa..." : "Ghi"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onCancel}
            >
              Bỏ
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
            {error}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ProductManagementCanceledNotice({ isLive }: Readonly<{ isLive: boolean }>) {
  return (
    <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
      <div
        className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]"
        data-testid="product-management-canceled"
      >
        Đã bỏ, chưa lưu vào danh sách.
      </div>
    </div>
  );
}

function DismissedPreviewNotice({
  isLive,
  content,
}: Readonly<{ isLive: boolean; content: string }>) {
  return (
    <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
      <div
        className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]"
        data-testid="dismissed-preview-notice"
      >
        {content}
      </div>
    </div>
  );
}

function DeleteOrderConfirmModal({
  open,
  summary,
  isUndoing,
  undoError,
  onConfirm,
  onCancel,
}: Readonly<{
  open: boolean;
  summary: string;
  isUndoing: boolean;
  undoError: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}>) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isUndoing) {
        event.preventDefault();
        onCancel();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    cancelButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isUndoing, onCancel]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inkDeep/45 px-4 py-6 backdrop-blur-[1px]"
      data-testid="delete-order-confirm-modal"
      onClick={() => {
        if (!isUndoing) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-[460px] rounded border border-ledgerBorder bg-surface px-5 py-5 text-textMain shadow-[0_24px_80px_-28px_rgba(23,37,84,0.55),0_1px_0_var(--ledger-border)] sm:px-6 sm:py-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-debt/10 text-debt">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3
              id={titleId}
              className="font-display text-2xl font-semibold leading-8 tracking-normal text-inkDeep"
            >
              Bỏ luôn cả đơn này?
            </h3>
            <p
              id={descriptionId}
              className="mt-2 text-[16px] leading-7 text-textMute"
            >
              {summary}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            disabled={isUndoing}
            className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onCancel}
          >
            Không
          </Button>
          <Button
            type="button"
            disabled={isUndoing}
            className="h-12 rounded bg-debt px-5 text-[16px] font-semibold text-paper hover:bg-debt/90 disabled:cursor-not-allowed disabled:opacity-55"
            onClick={() => void onConfirm()}
          >
            {isUndoing ? "Đang huỷ..." : "Bỏ đơn"}
          </Button>
        </div>

        {undoError ? (
          <p className="mt-3 text-[15px] leading-6 text-debt" role="alert">
            {undoError}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function PreviewCard({
  validated: initialValidated,
  answer = null,
  productManagementPreview = null,
  terminalText = null,
  aiTurnId = null,
  patched,
  ownerId,
  isLive,
  mode = "live",
  onPatchChange,
  onPickSample,
  restoredDraft = null,
  onRestoredDismiss,
}: PreviewCardProps) {
  const isRestored = mode === "restored";
  const isLiveMode = mode === "live";
  const [restoredValidated, setRestoredValidated] =
    React.useState<ValidatedIntent | null>(null);
  const validated = restoredValidated ?? initialValidated;
  const [notice, setNotice] = React.useState<string | null>(null);
  const [forceCreateCustomer, setForceCreateCustomer] = React.useState(false);
  const [dismissedCustomerCreate, setDismissedCustomerCreate] = React.useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);
  const [createCustomerError, setCreateCustomerError] = React.useState<string | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = React.useState(false);
  const [customerSearchInput, setCustomerSearchInput] = React.useState("");
  const [customerSearchResult, setCustomerSearchResult] =
    React.useState<ResolvedEntity | null>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = React.useState(false);
  const [customerSearchError, setCustomerSearchError] = React.useState<string | null>(null);
  const [customerSearchCreateOpen, setCustomerSearchCreateOpen] = React.useState(false);
  const [forceCreateSupplier, setForceCreateSupplier] = React.useState(false);
  const [dismissedSupplierCreate, setDismissedSupplierCreate] = React.useState(false);
  const [isCreatingSupplier, setIsCreatingSupplier] = React.useState(false);
  const [createSupplierError, setCreateSupplierError] = React.useState<string | null>(null);
  const [supplierSearchOpen, setSupplierSearchOpen] = React.useState(false);
  const [supplierSearchInput, setSupplierSearchInput] = React.useState("");
  const [supplierSearchResult, setSupplierSearchResult] =
    React.useState<ResolvedEntity | null>(null);
  const [supplierSearchLoading, setSupplierSearchLoading] = React.useState(false);
  const [supplierSearchError, setSupplierSearchError] = React.useState<string | null>(null);
  const [supplierSearchCreateOpen, setSupplierSearchCreateOpen] = React.useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = React.useState(false);
  const [createProductError, setCreateProductError] = React.useState<string | null>(null);
  const [productCreateItemIndex, setProductCreateItemIndex] = React.useState<number | null>(
    null,
  );
  const [dismissedProductCreateIndices, setDismissedProductCreateIndices] =
    React.useState<number[]>([]);
  const [productSearchOpen, setProductSearchOpen] = React.useState(false);
  const [productSearchInput, setProductSearchInput] = React.useState("");
  const [productSearchResult, setProductSearchResult] =
    React.useState<ResolvedEntity | null>(null);
  const [productSearchLoading, setProductSearchLoading] = React.useState(false);
  const [productSearchError, setProductSearchError] = React.useState<string | null>(null);
  const [productSearchCreateOpen, setProductSearchCreateOpen] = React.useState(false);
  const [idempotencyKey, setIdempotencyKey] = React.useState(
    restoredDraft?.idempotencyKey ?? makeIdempotencyKey,
  );
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [committedInfo, setCommittedInfo] = React.useState<CommittedInfo | null>(null);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const [dismissedPreview, setDismissedPreview] =
    React.useState<DismissedPreviewPayload | null>(null);
  const [isDismissingPreview, setIsDismissingPreview] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isResaving, setIsResaving] = React.useState(false);
  const [resaveError, setResaveError] = React.useState<string | null>(null);
  const [editPatchSnapshot, setEditPatchSnapshot] =
    React.useState<PreviewCardPatch | null>(null);
  const [isUndoing, setIsUndoing] = React.useState(false);
  const [undone, setUndone] = React.useState(false);
  const [undoError, setUndoError] = React.useState<string | null>(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = React.useState(false);
  const [productManagementState, setProductManagementState] =
    React.useState<ProductManagementPreview | null>(productManagementPreview);
  const [productManagementCreateDraft, setProductManagementCreateDraft] =
    React.useState<ProductManagementCreateFormState>(() =>
      productManagementPreview?.status === "create_draft"
        ? productManagementCreateFormFromPreview(productManagementPreview)
        : { name: "", unit: "cái", sellPriceInput: "" },
    );
  const [productManagementDismissed, setProductManagementDismissed] =
    React.useState(false);
  const [productManagementDeleteDismissed, setProductManagementDeleteDismissed] =
    React.useState(false);
  const [isSavingProductManagement, setIsSavingProductManagement] =
    React.useState(false);
  const [productManagementError, setProductManagementError] =
    React.useState<string | null>(null);
  // Current debt of the resolved customer, for the live overpayment check on
  // record_payment. null = unknown (loading/failed) -> client doesn't block; the
  // DB function still defends.
  const [customerDebt, setCustomerDebt] = React.useState<number | null>(null);
  const [drafts, setDrafts] = React.useState<DraftInputs>({
    prices: {},
    quantities: {},
    amount: "",
  });
  const latestPatchRef = React.useRef(patched);
  const dismissingPreviewRef = React.useRef(false);
  const state = getPatchedPreviewState(validated, patched);
  const liveInteractions = isLiveMode && isLive;
  const canDismissPreview = isPreviewDraftIntent(validated.intent);

  React.useEffect(() => {
    setRestoredValidated(null);

    if (isRestored && restoredDraft?.idempotencyKey) {
      setIdempotencyKey(restoredDraft.idempotencyKey);
    }
  }, [initialValidated, isRestored, restoredDraft?.idempotencyKey]);

  const handleCloseDeleteOrderConfirm = React.useCallback(() => {
    setConfirmDeleteOrder(false);
  }, []);

  React.useEffect(() => {
    if (
      !shouldKeepDeleteOrderConfirmOpen({
        kind: validated.kind,
        intent: validated.intent,
        hasCommitted: committedInfo !== null,
        itemCount: state.items.length,
        undone,
        isLive: liveInteractions,
        isEditing,
      })
    ) {
      setConfirmDeleteOrder(false);
    }
  }, [
    validated.kind,
    validated.intent,
    isEditing,
    liveInteractions,
    committedInfo,
    undone,
    state.items.length,
  ]);

  React.useEffect(() => {
    latestPatchRef.current = patched;
  }, [patched]);

  React.useEffect(() => {
    if (
      !isLiveMode ||
      !isLive ||
      isCommitting ||
      committedInfo ||
      dismissedPreview ||
      undone ||
      isEditing
    ) {
      return;
    }

    saveCurrentPreviewDraft({
      ownerId,
      validated,
      patched,
      state,
      idempotencyKey,
    });
  }, [
    committedInfo,
    dismissedPreview,
    idempotencyKey,
    isCommitting,
    isEditing,
    isLive,
    isLiveMode,
    ownerId,
    patched,
    state,
    undone,
    validated,
  ]);

  React.useEffect(() => {
    setProductManagementState(productManagementPreview);
    setProductManagementCreateDraft(
      productManagementPreview?.status === "create_draft"
        ? productManagementCreateFormFromPreview(productManagementPreview)
        : { name: "", unit: "cái", sellPriceInput: "" },
    );
    setProductManagementDismissed(false);
    setProductManagementDeleteDismissed(false);
    setIsSavingProductManagement(false);
    setProductManagementError(null);
  }, [productManagementPreview]);

  const paymentCustomerId =
    validated.intent === "record_payment"
      ? state.customer?.resolved_id ?? null
      : null;

  React.useEffect(() => {
    if (!paymentCustomerId) {
      setCustomerDebt(null);
      return;
    }

    let cancelled = false;

    getCustomerDebt(paymentCustomerId)
      .then((result) => {
        if (!cancelled) {
          setCustomerDebt(result.ok ? result.data.debt_total : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomerDebt(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paymentCustomerId]);

  function handleSelectProductManagementCandidate(
    candidate: ProductManagementCandidate,
  ) {
    if (productManagementState?.status !== "needs_choice") {
      return;
    }

    const product = productManagementProductFromCandidate(candidate);

    setProductManagementState(
      productManagementState.action === "delete"
        ? {
            status: "confirm_delete",
            action: "delete",
            product,
          }
        : {
            status: "ready",
            action: productManagementState.action,
            product,
            target: productManagementState.target,
          },
    );
    setProductManagementError(null);

    if (shouldLearnAlias(productManagementState.product_raw, candidate.name)) {
      void confirmAliasInBackground(
        "product",
        candidate.id,
        productManagementState.product_raw,
      );
    }
  }

  function handleProductManagementCreateDraftChange(
    field: keyof ProductManagementCreateFormState,
    value: string,
  ) {
    setProductManagementCreateDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setProductManagementError(null);
  }

  async function handleSaveProductManagementCreate() {
    if (
      productManagementState?.status !== "create_draft" ||
      isSavingProductManagement
    ) {
      return;
    }

    setIsSavingProductManagement(true);
    setProductManagementError(null);

    try {
      const result = await saveProductManagementCreatePreview(
        productManagementCreateDraft,
      );

      if (!result.ok) {
        setProductManagementError(result.message);
        return;
      }

      setProductManagementState(result.data);
      await persistProductManagementHistory(
        historyProductCardFromResult(result.data),
      );
    } catch (error) {
      console.error("createProduct from chat preview failed", error);
      setProductManagementError("Chưa tạo được hàng, bác thử lại ạ.");
    } finally {
      setIsSavingProductManagement(false);
    }
  }

  async function handleSaveProductManagement() {
    if (
      productManagementState?.status !== "ready" ||
      isSavingProductManagement
    ) {
      return;
    }

    setIsSavingProductManagement(true);
    setProductManagementError(null);

    try {
      const result = await saveProductManagementPreview(productManagementState);

      if (!result.ok) {
        setProductManagementError(result.message);
        return;
      }

      setProductManagementState(result.data);
      await persistProductManagementHistory(
        historyProductCardFromResult(result.data),
      );
    } catch (error) {
      console.error("updateProduct from chat preview failed", error);
      setProductManagementError("Chưa lưu được thay đổi, bác thử lại ạ.");
    } finally {
      setIsSavingProductManagement(false);
    }
  }

  async function handleDeleteProductManagement() {
    if (
      productManagementState?.status !== "confirm_delete" ||
      isSavingProductManagement
    ) {
      return;
    }

    setIsSavingProductManagement(true);
    setProductManagementError(null);

    try {
      const result = await saveProductManagementDeletePreview(
        productManagementState,
      );

      if (!result.ok) {
        setProductManagementError(result.message);
        return;
      }

      setProductManagementState(result.data);
      await persistProductManagementHistory(
        historyProductCardFromResult(result.data),
      );
    } catch (error) {
      console.error("deleteProduct from chat preview failed", error);
      setProductManagementError("Chưa xóa được hàng, bác thử lại ạ.");
    } finally {
      setIsSavingProductManagement(false);
    }
  }

  async function handleCancelProductManagement() {
    if (isSavingProductManagement) {
      return;
    }

    const card = productManagementState
      ? historyProductCardFromDismissedPreview(productManagementState)
      : null;

    setIsSavingProductManagement(true);
    setProductManagementError(null);

    if (card) {
      await persistProductManagementHistory(card);
    }

    setProductManagementDismissed(true);
    setIsSavingProductManagement(false);
  }

  async function handleCancelProductManagementDelete() {
    if (isSavingProductManagement) {
      return;
    }

    const card = productManagementState
      ? historyProductCardFromDismissedPreview(productManagementState)
      : null;

    setIsSavingProductManagement(true);
    setProductManagementError(null);

    if (card) {
      await persistProductManagementHistory(card);
    }

    setProductManagementDeleteDismissed(true);
    setIsSavingProductManagement(false);
  }

  if (productManagementPreview && productManagementDismissed) {
    return <ProductManagementCanceledNotice isLive={liveInteractions} />;
  }

  if (productManagementState) {
    if (productManagementState.action === "delete") {
      return (
        <ProductManagementDeletePreviewContent
          preview={productManagementState}
          isLive={liveInteractions}
          isSaving={isSavingProductManagement}
          isDismissed={productManagementDeleteDismissed}
          error={productManagementError}
          onSelectCandidate={handleSelectProductManagementCandidate}
          onSave={() => void handleDeleteProductManagement()}
          onCancel={() => void handleCancelProductManagementDelete()}
        />
      );
    }

    if (
      productManagementState.status === "create_draft" ||
      productManagementState.status === "create_duplicate" ||
      productManagementState.status === "created"
    ) {
      return (
        <ProductManagementCreatePreviewContent
          preview={productManagementState}
          isLive={liveInteractions}
          isSaving={isSavingProductManagement}
          error={productManagementError}
          draft={productManagementCreateDraft}
          onDraftChange={handleProductManagementCreateDraftChange}
          onSave={() => void handleSaveProductManagementCreate()}
          onCancel={() => void handleCancelProductManagement()}
        />
      );
    }

    return (
      <ProductManagementPreviewContent
        preview={productManagementState}
        isLive={liveInteractions}
        isSaving={isSavingProductManagement}
        error={productManagementError}
        onSelectCandidate={handleSelectProductManagementCandidate}
        onSave={() => void handleSaveProductManagement()}
        onCancel={() => void handleCancelProductManagement()}
      />
    );
  }

  if (dismissedPreview && canDismissPreview) {
    return dismissedPreview.card ? (
      <HistoryCommitCard
        card={dismissedPreview.card}
        confirmationText={dismissedPreview.content}
        confirmationTone="dismissed"
      />
    ) : (
      <DismissedPreviewNotice
        isLive={liveInteractions}
        content={dismissedPreview.content}
      />
    );
  }

  if (validated.kind === "none") {
    const capabilityCategory =
      validated.intent === "small_talk" || validated.intent === "unknown"
        ? detectCapabilityQuestion(validated.raw_text)
        : null;
    const capability = capabilityCategory
      ? capabilityReply(capabilityCategory)
      : null;

    return (
      <div
        className={cn("flex w-full justify-start", !liveInteractions && "opacity-70")}
        data-testid="preview-none"
      >
        <div className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]">
          <p>
            {capability?.content ??
              terminalText ??
              friendlyNoneMessage(validated.intent)}
          </p>
          {capability ? (
            <CapabilityChipRow chips={capability.chips} onPick={onPickSample} />
          ) : null}
        </div>
      </div>
    );
  }

  if (validated.kind === "query" || validated.kind === "edit" || validated.kind === "undo") {
    return (
      <div className={cn("flex w-full justify-start", !liveInteractions && "opacity-70")}>
        <article
          className="w-full max-w-[92%] rounded border border-ledgerBorder bg-surface px-4 py-4 text-[16px] leading-7 text-textMain shadow-[var(--shadow-card)] sm:max-w-[84%]"
          data-testid={`preview-${validated.kind}`}
        >
          {validated.kind === "query" ? (
            <>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Câu hỏi
              </p>
              <p className="mt-2 font-semibold text-inkDeep">{validated.raw_text}</p>
              <QueryAnswerContent answer={answer} />
              {!answer ? (
                <p className="mt-2 text-textMute">{compactFeatureText(validated.intent)}</p>
              ) : null}
            </>
          ) : (
            <p className="font-semibold text-inkDeep">
              {compactFeatureText(validated.intent)}
            </p>
          )}
        </article>
      </div>
    );
  }

  const title = TITLE_BY_INTENT[validated.intent] ?? "Thẻ đơn";
  const buttonLabel = BUTTON_BY_INTENT[validated.intent] ?? "Ghi đơn";
  const groups = issueGroups(state.issues);
  const counterparty = counterpartyEntity(validated, state);
  const entityName = counterpartyName(counterparty);
  const {
    isReopeningSaleOrder,
    interactive,
    canEditCounterpartyAndProducts,
    canChangeCustomerInEdit,
    canEditItemsInEdit,
    canShowEditOrderButton,
    canShowUndoButton,
    canShowResaveControls,
    resaveDisabled,
  } = getPreviewCardInteractionFlags({
    intent: validated.intent,
    isLive: liveInteractions,
    hasCommitted: committedInfo !== null,
    undone,
    isEditing,
    isResaving,
    canConfirm: state.canConfirm,
  });
  // Plan B: block paying more than the customer currently owes. Recomputed live
  // against the patched amount + fetched debt; the DB function defends too.
  const overpaymentBlocking =
    validated.intent === "record_payment" &&
    customerDebt !== null &&
    state.amount !== null &&
    state.amount > customerDebt;
  const showAmountPatch =
    interactive &&
    validated.intent === "record_payment" &&
    (
      (validated.effective_amount === null &&
        validated.issues.some(
          (issue) =>
            issue.code === "missing_amount" || issue.code === "invalid_amount",
        )) ||
      overpaymentBlocking ||
      // Keep the editor open once the amount has been touched, so it doesn't
      // vanish the moment an overpayment is corrected mid-typing.
      patched.amount !== null
    );
  const commitDisabled =
    !state.canConfirm || isCommitting || overpaymentBlocking;
  const restoredCommitDisabled =
    !state.canConfirm || isCommitting || overpaymentBlocking || committedInfo !== null;
  const dismissDisabled = isCommitting || isDismissingPreview || committedInfo !== null;
  const cardVisualActive = interactive || isRestored;
  const previewCardTestId = isRestored
    ? "preview-card-restored"
    : interactive
      ? "preview-card-live"
      : "preview-card-frozen";
  // For a payment, the header "Tổng tiền" mirrors the amount. While that amount
  // isn't valid-to-commit, show "—" instead of a number so a green total never
  // contradicts the red overpayment warning. Reuses the 007b overpaymentBlocking
  // flag (+ empty/<=0 amount); no new debt comparison.
  const paymentTotalUnsettled =
    validated.intent === "record_payment" &&
    (state.amount === null || state.amount <= 0 || overpaymentBlocking);
  const cardBusinessDate = getPreviewBusinessDate({
    intent: validated.intent,
    hasCommitted: committedInfo !== null,
    committedBusinessDate: committedInfo?.business_date,
    validatedBusinessDate: validated.business_date,
  });
  const deleteOrderConfirmOpen =
    confirmDeleteOrder &&
    shouldKeepDeleteOrderConfirmOpen({
      kind: validated.kind,
      intent: validated.intent,
      hasCommitted: committedInfo !== null,
      itemCount: state.items.length,
      undone,
      isLive: liveInteractions,
      isEditing,
    });
  const deleteOrderSummary = formatDeleteOrderSummary({
    customerName: entityName,
    total: state.total,
    firstItem: state.items[0]
      ? {
          name: state.items[0].name,
          quantity: state.items[0].quantity,
          unit: state.items[0].unit,
        }
      : null,
  });
  const supplierCreateRaw = supplierSearchResult?.raw ?? supplierSearchInput.trim();
  const canShowSupplierCreatePanel =
    supplierCreateRaw.length > 0 &&
    (supplierSearchCreateOpen || supplierSearchResult?.status === "not_found");
  const canShowSupplierSuggestions =
    supplierSearchResult !== null && !supplierSearchCreateOpen;
  const productCreateRaw = productSearchResult?.raw ?? productSearchInput.trim();
  const canShowProductCreatePanel =
    productCreateRaw.length > 0 &&
    (productSearchCreateOpen || productSearchResult?.status === "not_found");
  const canShowProductCreateToggle =
    productSearchResult !== null &&
    productSearchResult.status !== "not_found" &&
    productCreateRaw.length > 0 &&
    !productSearchCreateOpen;
  const canShowProductSuggestions =
    productSearchResult !== null && !productSearchCreateOpen;

  function clearCustomerSearchState() {
    setCustomerSearchOpen(false);
    setCustomerSearchInput("");
    setCustomerSearchResult(null);
    setCustomerSearchError(null);
    setCustomerSearchLoading(false);
    setCustomerSearchCreateOpen(false);
    setCreateCustomerError(null);
  }

  function handleOpenCustomerSearch() {
    setCustomerSearchOpen(true);
    setCustomerSearchInput(entityName ?? "");
    setCustomerSearchResult(null);
    setCustomerSearchError(null);
    setCustomerSearchCreateOpen(false);
    setCreateCustomerError(null);
  }

  function clearSupplierSearchState() {
    setSupplierSearchOpen(false);
    setSupplierSearchInput("");
    setSupplierSearchResult(null);
    setSupplierSearchError(null);
    setSupplierSearchLoading(false);
    setSupplierSearchCreateOpen(false);
    setCreateSupplierError(null);
  }

  function handleOpenSupplierSearch() {
    setSupplierSearchOpen(true);
    setSupplierSearchInput(entityName ?? counterparty?.raw ?? "");
    setSupplierSearchResult(null);
    setSupplierSearchError(null);
    setSupplierSearchCreateOpen(false);
    setCreateSupplierError(null);
  }

  async function handleSearchSupplier() {
    const name = supplierSearchInput.trim();

    if (supplierSearchLoading) {
      return;
    }

    if (!name) {
      setSupplierSearchResult(null);
      setSupplierSearchError(null);
      setSupplierSearchCreateOpen(false);
      return;
    }

    setSupplierSearchLoading(true);
    setSupplierSearchError(null);
    setSupplierSearchCreateOpen(false);

    try {
      const result = await searchSuppliersByName(name);

      if (!result.ok) {
        setSupplierSearchError(result.message);
        setSupplierSearchResult(null);
        return;
      }

      setSupplierSearchResult(result.data);
    } catch (error) {
      console.error("searchSuppliersByName failed", error);
      setSupplierSearchError("Chưa tìm được nhà cung cấp, bác thử lại ạ.");
      setSupplierSearchResult(null);
    } finally {
      setSupplierSearchLoading(false);
    }
  }

  async function handleSearchCustomer() {
    const name = customerSearchInput.trim();

    if (customerSearchLoading) {
      return;
    }

    if (!name) {
      setCustomerSearchResult(null);
      setCustomerSearchError(null);
      setCustomerSearchCreateOpen(false);
      return;
    }

    setCustomerSearchLoading(true);
    setCustomerSearchError(null);
    setCustomerSearchCreateOpen(false);

    try {
      const result = await searchCustomersByName(name);

      if (!result.ok) {
        setCustomerSearchError(result.message);
        setCustomerSearchResult(null);
        return;
      }

      setCustomerSearchResult(result.data);
    } catch (error) {
      console.error("searchCustomersByName failed", error);
      setCustomerSearchError("ChÆ°a tÃ¬m Ä‘Æ°á»£c khÃ¡ch, bÃ¡c thá»­ láº¡i áº¡.");
      setCustomerSearchResult(null);
    } finally {
      setCustomerSearchLoading(false);
    }
  }

  function applyEntityPatch(target: EntityTarget, entity: PreviewResolvedEntityPatch) {
    const currentPatch = latestPatchRef.current;

    if (target.type === "customer") {
      onPatchChange(updateCustomerPatch(currentPatch, entity));
      return;
    }

    if (target.type === "supplier") {
      onPatchChange(updateSupplierPatch(currentPatch, entity));
      return;
    }

    onPatchChange(updateItemProductPatch(currentPatch, target.itemIndex, entity));
  }

  function handleSelectCandidate(target: EntityTarget, candidate: EntityCandidate) {
    const entityPatch = entityPatchFromCandidate(target.entity, candidate);

    applyEntityPatch(target, entityPatch);
    if (target.type === "customer") {
      clearCustomerSearchState();
    }
    if (target.type === "supplier") {
      clearSupplierSearchState();
    }

    if (shouldLearnAlias(target.entity.raw, candidate.name)) {
      void confirmAliasInBackground(
        target.entity.entity_type,
        candidate.id,
        target.entity.raw,
      );
    }
  }

  async function handleCreateSupplier(rawName: string) {
    const name = rawName.trim();

    if (!name || isCreatingSupplier) {
      return;
    }

    setIsCreatingSupplier(true);
    setCreateSupplierError(null);

    try {
      const result = await createSupplier(name);

      if (!result.ok) {
        setCreateSupplierError(result.message);
        return;
      }

      onPatchChange(
        updateSupplierPatch(
          latestPatchRef.current,
          entityPatchFromCreatedSupplier(name, result.data),
        ),
      );
      setForceCreateSupplier(false);
      setDismissedSupplierCreate(false);
      clearSupplierSearchState();
    } catch (error) {
      console.error("createSupplier failed", error);
      setCreateSupplierError("Chưa thêm được nhà cung cấp, bác thử lại ạ.");
    } finally {
      setIsCreatingSupplier(false);
    }
  }

  async function handleCreateCustomer(rawName: string) {
    const name = rawName.trim();

    if (!name || isCreatingCustomer) {
      return;
    }

    setIsCreatingCustomer(true);
    setCreateCustomerError(null);

    try {
      const result = await createCustomer(name);

      if (!result.ok) {
        setCreateCustomerError(result.message);
        return;
      }

      onPatchChange(
        updateCustomerPatch(
          latestPatchRef.current,
          entityPatchFromCreatedCustomer(name, result.data),
        ),
      );
      setForceCreateCustomer(false);
      setDismissedCustomerCreate(false);
      clearCustomerSearchState();
    } catch (error) {
      console.error("createCustomer failed", error);
      setCreateCustomerError("Chưa thêm được khách, bác thử lại ạ.");
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  function clearProductSearchState() {
    setProductSearchOpen(false);
    setProductSearchInput("");
    setProductSearchResult(null);
    setProductSearchError(null);
    setProductSearchLoading(false);
    setProductSearchCreateOpen(false);
    setCreateProductError(null);
  }

  function handleOpenProductSearch() {
    setProductSearchOpen(true);
    setProductSearchInput("");
    setProductSearchResult(null);
    setProductSearchError(null);
    setProductSearchCreateOpen(false);
    setCreateProductError(null);
  }

  async function handleSearchProduct() {
    const name = productSearchInput.trim();

    if (productSearchLoading) {
      return;
    }

    if (!name) {
      setProductSearchResult(null);
      setProductSearchError(null);
      setProductSearchCreateOpen(false);
      return;
    }

    setProductSearchLoading(true);
    setProductSearchError(null);
    setProductSearchCreateOpen(false);
    setCreateProductError(null);

    try {
      const result = await searchProductsByName(name);

      if (!result.ok) {
        setProductSearchError(result.message);
        setProductSearchResult(null);
        return;
      }

      setProductSearchResult(result.data);
      setProductSearchCreateOpen(result.data.status === "not_found");
    } catch (error) {
      console.error("searchProductsByName failed", error);
      setProductSearchError("Chưa tìm được hàng, bác thử lại ạ.");
      setProductSearchResult(null);
    } finally {
      setProductSearchLoading(false);
    }
  }

  function handleSelectProduct(candidate: EntityCandidate) {
    onPatchChange(
      addItem(
        latestPatchRef.current,
        addedItemFromProductCandidate(candidate, makeAddedItemTempId()),
      ),
    );
    clearProductSearchState();

    if (
      productSearchResult &&
      shouldLearnAlias(productSearchResult.raw, candidate.name)
    ) {
      void confirmAliasInBackground("product", candidate.id, productSearchResult.raw);
    }
  }

  async function handleCreateProduct(
    rawName: string,
    draft: { unit: string; sell_price: number | null },
  ) {
    const name = rawName.trim();

    if (!name || isCreatingProduct) {
      return;
    }

    setProductCreateItemIndex(null);
    setIsCreatingProduct(true);
    setCreateProductError(null);

    try {
      const result = await createProduct(name, draft.unit, draft.sell_price);

      if (!result.ok) {
        setCreateProductError(result.message);
        return;
      }

      onPatchChange(
        addItem(
          latestPatchRef.current,
          addedItemFromCreatedProduct(result.data, makeAddedItemTempId()),
        ),
      );
      clearProductSearchState();
    } catch (error) {
      console.error("createProduct failed", error);
      setCreateProductError("Chưa thêm được mặt hàng, bác thử lại ạ.");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function handleCreateProductForItem(
    itemIndex: number,
    rawName: string,
    draft: { unit: string; sell_price: number | null },
  ) {
    if (!rawName.trim() || isCreatingProduct) {
      return;
    }

    setProductCreateItemIndex(itemIndex);
    setIsCreatingProduct(true);
    setCreateProductError(null);

    try {
      const result = await createProductPatchForItem({
        patch: latestPatchRef.current,
        itemIndex,
        rawName,
        draft,
      });

      if (!result.ok) {
        setCreateProductError(result.message);
        return;
      }

      onPatchChange(result.patch);
      setDismissedProductCreateIndices((indices) =>
        indices.filter((index) => index !== itemIndex),
      );
      setProductCreateItemIndex(null);
    } catch (error) {
      console.error("createProduct for item failed", error);
      setCreateProductError("Chưa thêm được mặt hàng, bác thử lại ạ.");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  function collectOrderItems(setError: (message: string) => void) {
    const items: CommitOrderItemInput[] = [];

    for (const displayItem of state.items) {
      const productId = displayItem.resolution.resolved_id;

      if (
        !productId ||
        displayItem.quantity === null ||
        displayItem.unitPrice === null
      ) {
        setError("Đơn còn món chưa đủ thông tin, bác kiểm lại giúp em ạ.");
        return null;
      }

      items.push({
        product_id: productId,
        product_name_snapshot: displayItem.name,
        unit_snapshot: displayItem.unit,
        quantity: displayItem.quantity,
        unit_price: displayItem.unitPrice,
      });
    }

    return items;
  }

  function clearLivePreviewDraft() {
    if (ownerId) {
      clearDraft(ownerId);
    }
  }

  function resaveLivePreviewDraft() {
    saveCurrentPreviewDraft({
      ownerId,
      validated,
      patched,
      state,
      idempotencyKey,
    });
  }

  async function handleCommitOrder() {
    // 007a writes create_order only. record_payment / create_purchase stay
    // on the placeholder toast until their own TIP.
    if (validated.intent !== "create_order") {
      setNotice("Phần ghi đơn thật sẽ có ở bước sau ạ.");
      return;
    }

    if (!state.canConfirm || isCommitting || committedInfo) {
      return;
    }

    const customerId = state.customer?.resolved_id ?? null;

    if (!customerId) {
      setCommitError("Chưa rõ khách, bác chọn khách giúp em ạ.");
      return;
    }

    const items = collectOrderItems(setCommitError);

    if (!items) {
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setNotice(null);
    clearLivePreviewDraft();

    try {
      const result = await commitOrder({
        ...(aiTurnId ? { ai_turn_id: aiTurnId } : {}),
        idempotency_key: idempotencyKey,
        customer_id: customerId,
        customer_name: entityName,
        raw_input: validated.raw_text,
        ...businessDateCommitInput(validated.business_date),
        items,
      });

      if (!result.ok) {
        setCommitError(result.message);
        resaveLivePreviewDraft();
        return;
      }

      setCommittedInfo({
        id: result.data.order_id,
        business_date: result.data.business_date,
        message: commitConfirmationMessage({
          type: "create_order",
          entityName,
        }),
      });
      setResaveError(null);
    } catch (error) {
      console.error("commitOrder failed", error);
      resaveLivePreviewDraft();
      setCommitError("Chưa ghi được đơn, bác thử lại ạ.");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCommitPayment() {
    if (validated.intent !== "record_payment") {
      return;
    }

    if (!state.canConfirm || overpaymentBlocking || isCommitting || committedInfo) {
      return;
    }

    const customerId = state.customer?.resolved_id ?? null;
    const amount = state.amount;

    if (!customerId) {
      setCommitError("Chưa rõ khách, bác chọn khách giúp em ạ.");
      return;
    }

    if (amount === null || !(amount > 0)) {
      setCommitError("Chưa rõ số tiền, bác nhập lại giúp em ạ.");
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setNotice(null);
    clearLivePreviewDraft();

    try {
      const result = await commitPayment({
        ...(aiTurnId ? { ai_turn_id: aiTurnId } : {}),
        idempotency_key: idempotencyKey,
        customer_id: customerId,
        customer_name: entityName,
        amount,
        raw_input: validated.raw_text,
      });

      if (!result.ok) {
        setCommitError(result.message);
        resaveLivePreviewDraft();
        return;
      }

      setCommittedInfo({
        id: result.data.payment_id,
        business_date: null,
        message: commitConfirmationMessage({
          type: "record_payment",
          entityName,
        }),
      });
    } catch (error) {
      console.error("commitPayment failed", error);
      resaveLivePreviewDraft();
      setCommitError("Chưa ghi được, bác thử lại ạ.");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCommitPurchase() {
    if (validated.intent !== "create_purchase") {
      return;
    }

    if (!state.canConfirm || isCommitting || committedInfo) {
      return;
    }

    const items: CommitPurchaseItemInput[] = [];

    for (const displayItem of state.items) {
      const productId = displayItem.resolution.resolved_id;

      if (
        !productId ||
        displayItem.quantity === null ||
        displayItem.unitPrice === null
      ) {
        setCommitError("Đơn nhập còn món chưa đủ thông tin, bác kiểm lại giúp em ạ.");
        return;
      }

      items.push({
        product_id: productId,
        product_name_snapshot: displayItem.name,
        unit_snapshot: displayItem.unit,
        quantity: displayItem.quantity,
        // For a purchase the "đơn giá" column is the purchase cost (unit_cost).
        unit_cost: displayItem.unitPrice,
      });
    }

    setIsCommitting(true);
    setCommitError(null);
    setNotice(null);
    clearLivePreviewDraft();

    try {
      const supplierName = counterpartyName(state.supplier);

      const result = await commitPurchase({
        ...(aiTurnId ? { ai_turn_id: aiTurnId } : {}),
        idempotency_key: idempotencyKey,
        supplier_id: state.supplier?.resolved_id ?? null,
        supplier_name: supplierName,
        raw_input: validated.raw_text,
        ...businessDateCommitInput(validated.business_date),
        items,
      });

      if (!result.ok) {
        setCommitError(result.message);
        resaveLivePreviewDraft();
        return;
      }

      setCommittedInfo({
        id: result.data.purchase_id,
        business_date: result.data.business_date,
        message: commitConfirmationMessage({
          type: "create_purchase",
          supplierName,
        }),
      });
    } catch (error) {
      console.error("commitPurchase failed", error);
      resaveLivePreviewDraft();
      setCommitError("Chưa ghi được đơn nhập, bác thử lại ạ.");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCommitRestoredDraft() {
    if (!restoredDraft || isCommitting || committedInfo) {
      return;
    }

    setIsCommitting(true);
    setCommitError(null);
    setNotice(null);

    const result = await commitRestoredPreviewDraft(restoredDraft);

    if (result.validated) {
      setRestoredValidated(result.validated);
    }

    if (!result.ok) {
      setCommitError(result.message);
      setIsCommitting(false);
      return;
    }

    setCommittedInfo(result.committedInfo);
    setResaveError(null);
    setIsCommitting(false);
  }

  function handleDismissPreview() {
    if (
      !isPreviewDraftIntent(validated.intent) ||
      dismissedPreview ||
      isCommitting ||
      committedInfo
    ) {
      return;
    }

    if (!claimDismissPreview(dismissingPreviewRef)) {
      return;
    }

    const intent = validated.intent;
    const entityName = entityNameForState(intent, state);
    const content =
      intent === "create_purchase"
        ? dismissedPreviewMessage({ type: intent, supplierName: entityName })
        : dismissedPreviewMessage({ type: intent, entityName });
    const card = buildDismissedPreviewCardFromState(
      state,
      intent,
      cardBusinessDate,
    );
    const payload: DismissedPreviewPayload = { content, card };

    if (!card) {
      console.warn("Failed to build dismissed preview card snapshot");
    }

    setIsDismissingPreview(true);
    setDismissedPreview(payload);
    setCommitError(null);
    setNotice(null);

    if (isRestored) {
      if (restoredDraft) {
        clearDraft(restoredDraft.ownerId);
      }

      onRestoredDismiss?.(payload);
    } else {
      clearLivePreviewDraft();
    }

    void persistDismissedPreviewMessage({
      ...(aiTurnId ? { ai_turn_id: aiTurnId } : {}),
      intent,
      content,
      card,
    })
      .then((result) => {
        if (!result.ok) {
          console.warn("Failed to persist dismissed preview message", result);
        }
      })
      .catch((error) => {
        console.warn("Failed to persist dismissed preview message", error);
      });
  }

  function handleConfirmClick() {
    if (isRestored) {
      void handleCommitRestoredDraft();
      return;
    }

    if (validated.intent === "create_order") {
      void handleCommitOrder();
      return;
    }

    if (validated.intent === "record_payment") {
      void handleCommitPayment();
      return;
    }

    if (validated.intent === "create_purchase") {
      void handleCommitPurchase();
      return;
    }

    setNotice("Phần ghi đơn thật sẽ có ở bước sau ạ.");
  }

  function handleStartEditOrder() {
    if (
      validated.intent !== "create_order" ||
      !committedInfo ||
      !liveInteractions ||
      undone ||
      isEditing
    ) {
      return;
    }

    setIdempotencyKey(makeIdempotencyKey());
    setEditPatchSnapshot(latestPatchRef.current);
    setIsEditing(true);
    setResaveError(null);
    setCommitError(null);
    setUndoError(null);
    setConfirmDeleteOrder(false);
  }

  function handleCancelEditOrder() {
    if (isResaving) {
      return;
    }

    if (editPatchSnapshot) {
      onPatchChange(editPatchSnapshot);
    }

    setIsEditing(false);
    setEditPatchSnapshot(null);
    setResaveError(null);
    setConfirmDeleteOrder(false);
    clearCustomerSearchState();
    clearProductSearchState();
  }

  async function handleResaveOrder() {
    if (
      validated.intent !== "create_order" ||
      !committedInfo ||
      !isEditing ||
      isResaving ||
      !state.canConfirm
    ) {
      return;
    }

    const customerId = state.customer?.resolved_id ?? null;

    if (!customerId) {
      setResaveError("Chưa rõ khách, bác kiểm lại giúp em ạ.");
      return;
    }

    const items = collectOrderItems(setResaveError);

    if (!items) {
      return;
    }

    setIsResaving(true);
    setResaveError(null);

    try {
      const result = await recreateSaleOrder({
        oldOrderId: committedInfo.id,
        idempotencyKey,
        customer_id: customerId,
        raw_input: validated.raw_text,
        items,
      });

      if (!result.ok) {
        const message =
          result.code === "recommit_failed" || result.oldVoided
            ? "Đơn cũ đã huỷ, ghi lại không thành công. Bác tạo lại đơn giúp em ạ."
            : result.message || "Đơn này không sửa được nữa ạ.";

        setResaveError(message);
        setIsEditing(false);
        setEditPatchSnapshot(null);
        setConfirmDeleteOrder(false);
        clearCustomerSearchState();
        clearProductSearchState();

        if (result.code === "recommit_failed" || result.oldVoided) {
          setUndone(true);
        }

        return;
      }

      setCommittedInfo({
        id: result.data.newOrderId,
        business_date: result.data.business_date,
        message: commitConfirmationMessage({ type: "edit_order" }),
      });
      setIsEditing(false);
      setEditPatchSnapshot(null);
      setResaveError(null);
      setUndoError(null);
      setConfirmDeleteOrder(false);
      setCommitError(null);
      setIdempotencyKey(makeIdempotencyKey());
      clearCustomerSearchState();
      clearProductSearchState();
    } catch (error) {
      console.error("recreateSaleOrder failed", error);
      setResaveError("Chưa ghi lại được đơn, bác thử lại ạ.");
      setIsEditing(false);
      setEditPatchSnapshot(null);
      clearCustomerSearchState();
      clearProductSearchState();
    } finally {
      setIsResaving(false);
    }
  }

  async function handleUndo() {
    if (!committedInfo || isUndoing || undone) {
      return;
    }

    if (committedInfo.id.length === 0) {
      console.error("undoCommit skipped: missing committed order id");
      return;
    }

    const target: UndoTarget | null =
      validated.intent === "create_order"
        ? "order"
        : validated.intent === "record_payment"
          ? "payment"
          : validated.intent === "create_purchase"
            ? "purchase"
            : null;

    if (!target) {
      return;
    }

    setIsUndoing(true);
    setUndoError(null);
    setResaveError(null);

    try {
      const result = await undoCommit(
        target,
        committedInfo.id,
        aiTurnId ?? undefined,
      );

      if (!result.ok) {
        setUndoError(result.message);
        return;
      }

      setUndone(true);
      setIsEditing(false);
      setEditPatchSnapshot(null);
      setConfirmDeleteOrder(false);
    } catch (error) {
      console.error("undoCommit failed", error);
      setUndoError("Chưa huỷ được, bác thử lại ạ.");
    } finally {
      setIsUndoing(false);
    }
  }

  function handlePriceChange(itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [itemIndex]: value,
      },
    }));
    onPatchChange(updateItemPricePatch(patched, itemIndex, parseVietnameseNumber(value)));
  }

  function handleQuantityChange(itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      quantities: {
        ...current.quantities,
        [itemIndex]: value,
      },
    }));
    onPatchChange(
      updateItemQuantityPatch(patched, itemIndex, parseVietnameseNumber(value)),
    );
  }

  function clearItemDraft(itemIndex: number) {
    setDrafts((current) => {
      const prices = { ...current.prices };
      const quantities = { ...current.quantities };
      delete prices[itemIndex];
      delete quantities[itemIndex];

      return {
        ...current,
        prices,
        quantities,
      };
    });
  }

  function handleAddedPriceChange(tempId: string, itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [itemIndex]: value,
      },
    }));
    onPatchChange(
      updateAddedItemPrice(latestPatchRef.current, tempId, parseVietnameseNumber(value)),
    );
  }

  function handleAddedQuantityChange(tempId: string, itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      quantities: {
        ...current.quantities,
        [itemIndex]: value,
      },
    }));
    onPatchChange(
      updateAddedItemQuantity(
        latestPatchRef.current,
        tempId,
        parseVietnameseNumber(value),
      ),
    );
  }

  function handleDisplayPriceChange(displayItem: PreviewDisplayItem, value: string) {
    if (displayItem.tempId) {
      handleAddedPriceChange(displayItem.tempId, displayItem.index, value);
      return;
    }

    handlePriceChange(displayItem.index, value);
  }

  function handleDisplayQuantityChange(displayItem: PreviewDisplayItem, value: string) {
    if (displayItem.tempId) {
      handleAddedQuantityChange(displayItem.tempId, displayItem.index, value);
      return;
    }

    handleQuantityChange(displayItem.index, value);
  }

  function handleRemoveDisplayItem(displayItem: PreviewDisplayItem) {
    const removeMode = getOrderItemRemoveMode({
      itemCount: state.items.length,
      isReopeningSaleOrder,
    });

    if (removeMode === "disabled") {
      return;
    }

    if (removeMode === "confirm-delete-order") {
      setUndoError(null);
      setConfirmDeleteOrder(true);
      return;
    }

    setConfirmDeleteOrder(false);
    clearItemDraft(displayItem.index);

    if (displayItem.tempId) {
      onPatchChange(removeAddedItem(latestPatchRef.current, displayItem.tempId));
      return;
    }

    onPatchChange(removeIndex(latestPatchRef.current, displayItem.index));
  }

  function handleAmountChange(value: string) {
    setDrafts((current) => ({
      ...current,
      amount: value,
    }));
    onPatchChange(updateAmountPatch(patched, parseVietnameseNumber(value)));
  }

  function quantityInputValue(itemIndex: number, value: number | null) {
    return drafts.quantities[itemIndex] ?? (value === null ? "" : String(value));
  }

  function priceInputValue(itemIndex: number, value: number | null) {
    return drafts.prices[itemIndex] ?? (value === null ? "" : String(Math.round(value)));
  }

  return (
    <div className={cn("flex w-full justify-start", !cardVisualActive && "opacity-70")}>
      <article
        className={cn(
          "w-full max-w-[94%] rounded border px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]",
          cardVisualActive
            ? "border-ledgerBorder bg-surface"
            : "border-ledgerBorder bg-paperWarm shadow-none",
        )}
        data-testid={previewCardTestId}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ledgerBorder pb-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
              {validated.intent}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
              {title}
            </h2>
            {cardBusinessDate ? (
              <p className="mt-1 text-[14px] leading-5 text-textMute">
                Ngày: {formatPreviewBusinessDate(cardBusinessDate)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[14px] leading-5 text-textMute">Tổng tiền</p>
            <p
              className={cn(
                "font-display text-2xl font-semibold tracking-normal",
                paymentTotalUnsettled ? "text-textMute" : "text-paid",
              )}
            >
              {paymentTotalUnsettled ? "—" : formatVietnameseMoney(state.total)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
          <p className="font-semibold text-textMute">{counterpartyLabel(validated)}</p>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {entityName ? (
                <p className="font-semibold text-inkDeep">{entityName}</p>
              ) : (
                <p className="font-semibold text-debt">
                  {unresolvedCounterpartyText(validated)}
                </p>
              )}
              {canChangeCustomerInEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded border-ledgerBorder bg-surface px-3 text-[14px] font-semibold text-ink hover:bg-paperWarm"
                  onClick={
                    customerSearchOpen
                      ? clearCustomerSearchState
                      : handleOpenCustomerSearch
                  }
                >
                  {customerSearchOpen ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  {customerSearchOpen ? "Đóng" : "Đổi khách"}
                </Button>
              ) : null}
              {canEditCounterpartyAndProducts && validated.intent === "create_purchase" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded border-ledgerBorder bg-surface px-3 text-[14px] font-semibold text-ink hover:bg-paperWarm"
                  onClick={
                    supplierSearchOpen
                      ? clearSupplierSearchState
                      : handleOpenSupplierSearch
                  }
                >
                  {supplierSearchOpen ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  {supplierSearchOpen
                    ? "Đóng"
                    : entityName
                      ? "Đổi nhà cung cấp"
                      : "Tìm nhà cung cấp"}
                </Button>
              ) : null}
            </div>
            {canChangeCustomerInEdit && customerSearchOpen ? (
              <div
                className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3"
                data-testid="edit-customer-search"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Tìm khách</span>
                    <input
                      type="text"
                      value={customerSearchInput}
                      placeholder="Nhập tên khách"
                      className="h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink"
                      onChange={(event) => {
                        setCustomerSearchInput(event.target.value);
                        setCustomerSearchResult(null);
                        setCustomerSearchError(null);
                        setCustomerSearchCreateOpen(false);
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    className="h-11 rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={customerSearchLoading}
                    onClick={() => void handleSearchCustomer()}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {customerSearchLoading ? "Đang tìm..." : "Tìm"}
                  </Button>
                </div>
                {customerSearchError ? (
                  <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                    {customerSearchError}
                  </p>
                ) : null}
                {customerSearchResult ? (
                  <EntityChoicePanel
                    entity={customerSearchResult}
                    label="Khách"
                    allowCreate
                    onSelect={(candidate) =>
                      handleSelectCandidate(
                        { type: "customer", entity: customerSearchResult },
                        candidate,
                      )
                    }
                    onCreate={() => {
                      setCustomerSearchCreateOpen(true);
                      setCreateCustomerError(null);
                    }}
                  />
                ) : null}
                {customerSearchCreateOpen &&
                (customerSearchResult?.raw ?? customerSearchInput.trim()) ? (
                  <CustomerCreatePanel
                    raw={customerSearchResult?.raw ?? customerSearchInput.trim()}
                    isSaving={isCreatingCustomer}
                    error={createCustomerError}
                    onCreate={() =>
                      handleCreateCustomer(
                        customerSearchResult?.raw ?? customerSearchInput.trim(),
                      )
                    }
                    onDismiss={() => {
                      setCustomerSearchCreateOpen(false);
                      setCreateCustomerError(null);
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {canEditCounterpartyAndProducts &&
            validated.intent === "create_purchase" &&
            supplierSearchOpen ? (
              <div
                className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3"
                data-testid="supplier-search"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Tìm nhà cung cấp</span>
                    <input
                      type="text"
                      value={supplierSearchInput}
                      placeholder="Nhập tên nhà cung cấp"
                      className="h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink"
                      onChange={(event) => {
                        setSupplierSearchInput(event.target.value);
                        setSupplierSearchResult(null);
                        setSupplierSearchError(null);
                        setSupplierSearchCreateOpen(false);
                      }}
                    />
                  </label>
                  <Button
                    type="button"
                    className="h-11 rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={supplierSearchLoading}
                    onClick={() => void handleSearchSupplier()}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {supplierSearchLoading ? "Đang tìm..." : "Tìm"}
                  </Button>
                </div>
                {supplierSearchError ? (
                  <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                    {supplierSearchError}
                  </p>
                ) : null}
                {canShowSupplierSuggestions && supplierSearchResult ? (
                  <EntityChoicePanel
                    entity={supplierSearchResult}
                    label="Nhà cung cấp"
                    allowCreate
                    createLabel="nhà cung cấp"
                    onSelect={(candidate) =>
                      handleSelectCandidate(
                        { type: "supplier", entity: supplierSearchResult },
                        candidate,
                      )
                    }
                    onCreate={() => {
                      setSupplierSearchCreateOpen(true);
                      setCreateSupplierError(null);
                    }}
                  />
                ) : null}
                {canShowSupplierCreatePanel ? (
                  <SupplierCreatePanel
                    raw={supplierCreateRaw}
                    isSaving={isCreatingSupplier}
                    error={createSupplierError}
                    onCreate={() => handleCreateSupplier(supplierCreateRaw)}
                    onDismiss={() => {
                      setSupplierSearchCreateOpen(false);
                      setCreateSupplierError(null);
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {canEditCounterpartyAndProducts &&
            counterparty?.entity_type === "customer" &&
            (counterparty.status === "needs_confirmation" ||
              counterparty.status === "ambiguous") &&
            !forceCreateCustomer ? (
              <EntityChoicePanel
                entity={counterparty}
                label="Khách"
                allowCreate
                onSelect={(candidate) =>
                  handleSelectCandidate({ type: "customer", entity: counterparty }, candidate)
                }
                onCreate={() => {
                  setCreateCustomerError(null);
                  setForceCreateCustomer(true);
                  setDismissedCustomerCreate(false);
                }}
              />
            ) : null}
            {canEditCounterpartyAndProducts &&
            counterparty?.entity_type === "supplier" &&
            (counterparty.status === "needs_confirmation" ||
              counterparty.status === "ambiguous") &&
            !forceCreateSupplier ? (
              <EntityChoicePanel
                entity={counterparty}
                label="Nhà cung cấp"
                allowCreate
                createLabel="nhà cung cấp"
                onSelect={(candidate) =>
                  handleSelectCandidate({ type: "supplier", entity: counterparty }, candidate)
                }
                onCreate={() => {
                  setCreateSupplierError(null);
                  setForceCreateSupplier(true);
                  setDismissedSupplierCreate(false);
                }}
              />
            ) : null}
            {canEditCounterpartyAndProducts &&
            counterparty?.entity_type === "customer" &&
            counterparty.raw &&
            !entityName &&
            !dismissedCustomerCreate &&
            (forceCreateCustomer || counterparty.status === "not_found") ? (
              <CustomerCreatePanel
                raw={counterparty.raw}
                isSaving={isCreatingCustomer}
                error={createCustomerError}
                onCreate={() => handleCreateCustomer(counterparty.raw ?? "")}
                onDismiss={() => {
                  setForceCreateCustomer(false);
                  setDismissedCustomerCreate(true);
                  setCreateCustomerError(null);
                }}
              />
            ) : null}
            {canEditCounterpartyAndProducts &&
            counterparty?.entity_type === "supplier" &&
            counterparty.raw &&
            !entityName &&
            !dismissedSupplierCreate &&
            (forceCreateSupplier || counterparty.status === "not_found") ? (
              <SupplierCreatePanel
                raw={counterparty.raw}
                isSaving={isCreatingSupplier}
                error={createSupplierError}
                onCreate={() => handleCreateSupplier(counterparty.raw ?? "")}
                onDismiss={() => {
                  setForceCreateSupplier(false);
                  setDismissedSupplierCreate(true);
                  setCreateSupplierError(null);
                }}
              />
            ) : null}
          </div>
        </div>

        {validated.intent === "record_payment" ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Số tiền</p>
              {showAmountPatch ? (
                <PatchInput
                  label="Nhập số tiền"
                  placeholder="Nhập số tiền"
                  value={drafts.amount}
                  onChange={handleAmountChange}
                />
              ) : (
                <p className="font-semibold text-inkDeep">
                  {formatVietnameseMoney(state.amount)}
                </p>
              )}
            </div>
            {overpaymentBlocking ? (
              <p
                className="mt-2 text-[15px] leading-6 text-debt"
                role="alert"
                data-testid="overpayment-blocking"
              >
                Số tiền trả {formatVietnameseMoney(state.amount)} lớn hơn số nợ hiện
                tại ({formatVietnameseMoney(customerDebt)}). Bác sửa xuống cho khớp ạ.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded border border-ledgerBorder">
            <div
              className={cn(
                "hidden gap-2 bg-paperWarm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp sm:grid",
                canEditItemsInEdit
                  ? "sm:grid-cols-[1.4fr_0.65fr_0.45fr_0.9fr_0.9fr_auto]"
                  : "sm:grid-cols-[1.5fr_0.75fr_0.55fr_1fr_1fr]",
              )}
            >
              <span>Mặt hàng</span>
              <span>Số lượng</span>
              <span>Đơn vị</span>
              <span className="hidden sm:block">Đơn giá</span>
              <span className="hidden sm:block">Thành tiền</span>
              {canEditItemsInEdit ? <span className="text-right">Thao tác</span> : null}
            </div>
            <div className="divide-y divide-ledgerBorder">
              {state.items.map((displayItem) => {
                const quantityDraft = quantityInputValue(
                  displayItem.index,
                  displayItem.quantity,
                );
                const priceDraft = priceInputValue(
                  displayItem.index,
                  displayItem.unitPrice,
                );
                const showQuantityInput = interactive;
                const showPriceInput = interactive;
                const productNeedsChoice =
                  canEditCounterpartyAndProducts &&
                  (displayItem.resolution.status === "needs_confirmation" ||
                    displayItem.resolution.status === "ambiguous");
                const productNotFound =
                  canEditCounterpartyAndProducts &&
                  displayItem.resolution.status === "not_found";
                const inlineProductRaw =
                  displayItem.resolution.raw ??
                  displayItem.item.product_name ??
                  displayItem.item.raw;
                const productCreateDismissed =
                  dismissedProductCreateIndices.includes(displayItem.index);
                const removeMode = getOrderItemRemoveMode({
                  itemCount: state.items.length,
                  isReopeningSaleOrder,
                });
                const removeDisabled = removeMode === "disabled";
                const removeTitle =
                  removeMode === "confirm-delete-order"
                    ? "Bỏ đơn này"
                    : `Xóa dòng ${displayItem.name}`;

                return (
                  <div
                    key={`${displayItem.item.raw}-${displayItem.index}`}
                    className={cn(
                      "block px-3 py-3 text-[16px] leading-7 sm:grid sm:gap-2",
                      canEditItemsInEdit
                        ? "sm:grid-cols-[1.4fr_0.65fr_0.45fr_0.9fr_0.9fr_auto]"
                        : "sm:grid-cols-[1.5fr_0.75fr_0.55fr_1fr_1fr]",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-inkDeep">{displayItem.name}</p>
                      {productNeedsChoice ? (
                        <EntityChoicePanel
                          entity={displayItem.resolution}
                          label="Hàng"
                          allowCreate={false}
                          onSelect={(candidate) =>
                            handleSelectCandidate(
                              {
                                type: "product",
                                entity: displayItem.resolution,
                                itemIndex: displayItem.index,
                              },
                              candidate,
                            )
                          }
                        />
                      ) : null}
                      {productNotFound && productCreateDismissed ? (
                        <ProductMissingNotice
                          raw={inlineProductRaw}
                          onCreate={() => {
                            setDismissedProductCreateIndices((indices) =>
                              indices.filter((index) => index !== displayItem.index),
                            );
                            setProductCreateItemIndex(displayItem.index);
                            setCreateProductError(null);
                          }}
                        />
                      ) : null}
                      {productNotFound && !productCreateDismissed ? (
                        <ProductCreatePanel
                          raw={inlineProductRaw}
                          defaultUnit={displayItem.unit ?? ""}
                          defaultSellPrice={
                            validated.intent === "create_order"
                              ? displayItem.unitPrice
                              : null
                          }
                          submitLabel="Tạo hàng"
                          isSaving={isCreatingProduct}
                          error={
                            productCreateItemIndex === displayItem.index
                              ? createProductError
                              : null
                          }
                          onCreate={(draft) =>
                            void handleCreateProductForItem(
                              displayItem.index,
                              inlineProductRaw,
                              draft,
                            )
                          }
                          onDismiss={() => {
                            setDismissedProductCreateIndices((indices) =>
                              indices.includes(displayItem.index)
                                ? indices
                                : [...indices, displayItem.index],
                            );
                            setProductCreateItemIndex(null);
                            setCreateProductError(null);
                          }}
                          onDraftChange={() => setCreateProductError(null)}
                        />
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                        Số lượng
                      </p>
                      <div>
                        {showQuantityInput ? (
                          <PatchInput
                            label={`Sửa số lượng ${displayItem.name}`}
                            placeholder="Nhập SL"
                            value={quantityDraft}
                            onChange={(value) =>
                              handleDisplayQuantityChange(displayItem, value)
                            }
                          />
                        ) : (
                          <p className="font-semibold">
                            {displayItem.quantity ?? "Chưa có"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                        Đơn vị
                      </p>
                      <div>
                        <p className="font-semibold text-textMute">
                          {displayItem.unit ?? ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                        Đơn giá
                      </p>
                      <div>
                        {showPriceInput ? (
                          <PatchInput
                            label={`Sửa giá ${displayItem.name}`}
                            placeholder={`Nhập giá ${displayItem.unit ?? "1 đơn vị"}`}
                            value={priceDraft}
                            onChange={(value) =>
                              handleDisplayPriceChange(displayItem, value)
                            }
                          />
                        ) : (
                          <p className="font-semibold">
                            {formatVietnameseMoney(displayItem.unitPrice)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                        Thành tiền
                      </p>
                      <div>
                        <p className="font-semibold text-inkDeep">
                          {formatVietnameseMoney(displayItem.lineTotal)}
                        </p>
                      </div>
                    </div>
                    {canEditItemsInEdit ? (
                      <div className="mt-3 flex justify-end sm:mt-0 sm:block sm:text-right">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={removeDisabled}
                          title={removeTitle}
                          aria-label={removeTitle}
                          className="h-11 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-debt disabled:cursor-not-allowed disabled:opacity-55 sm:h-9 sm:px-2"
                          onClick={() => handleRemoveDisplayItem(displayItem)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {canEditItemsInEdit ? (
              <div className="border-t border-ledgerBorder bg-surface px-3 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-ink hover:bg-paperWarm"
                  onClick={
                    productSearchOpen
                      ? clearProductSearchState
                      : handleOpenProductSearch
                  }
                >
                  {productSearchOpen ? (
                    <X className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  {productSearchOpen ? "Đóng" : "Thêm hàng"}
                </Button>
                {productSearchOpen ? (
                  <div
                    className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3"
                    data-testid="edit-product-search"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">Tìm mặt hàng</span>
                        <input
                          type="text"
                          value={productSearchInput}
                          placeholder="Nhập tên mặt hàng"
                          className="h-11 w-full rounded border border-stamp/35 bg-surface px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink"
                          onChange={(event) => {
                            setProductSearchInput(event.target.value);
                            setProductSearchResult(null);
                            setProductSearchError(null);
                            setProductSearchCreateOpen(false);
                            setCreateProductError(null);
                          }}
                        />
                      </label>
                      <Button
                        type="button"
                        className="h-11 rounded bg-ink px-4 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={productSearchLoading}
                        onClick={() => void handleSearchProduct()}
                      >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {productSearchLoading ? "Đang tìm..." : "Tìm"}
                      </Button>
                    </div>
                    {productSearchError ? (
                      <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                        {productSearchError}
                      </p>
                    ) : null}
                    {canShowProductSuggestions ? (
                      <EntityChoicePanel
                        entity={productSearchResult}
                        label="Hàng"
                        allowCreate={false}
                        onSelect={handleSelectProduct}
                      />
                    ) : null}
                    {canShowProductCreateToggle ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-2 h-auto min-h-10 justify-start px-0 text-[15px] font-semibold text-stamp hover:bg-transparent hover:text-ink"
                        onClick={() => {
                          setProductSearchCreateOpen(true);
                          setCreateProductError(null);
                        }}
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Thêm mặt hàng mới: &quot;{productCreateRaw}&quot;
                      </Button>
                    ) : null}
                    {canShowProductCreatePanel ? (
                      <ProductCreatePanel
                        raw={productCreateRaw}
                        isSaving={isCreatingProduct}
                        error={
                          productCreateItemIndex === null ? createProductError : null
                        }
                        onCreate={(draft) =>
                          void handleCreateProduct(productCreateRaw, draft)
                        }
                        onDismiss={() => {
                          setProductSearchCreateOpen(false);
                          setCreateProductError(null);
                        }}
                        onDraftChange={() => setCreateProductError(null)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <IssuePanel title="Cần bổ sung" tone="blocking" issues={groups.blocking} />
          <IssuePanel title="Cần kiểm tra" tone="warning" issues={groups.warning} />
          <IssuePanel title="Ghi chú" tone="info" issues={groups.info} />
        </div>

        {undone ? (
          <div
            className="mt-4 border-t border-ledgerBorder pt-3"
            data-testid="order-undone"
          >
            <p className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-textMute">
              <X className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="line-through">Đã huỷ đơn</span>
            </p>
            {resaveError ? (
              <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                {resaveError}
              </p>
            ) : null}
          </div>
        ) : committedInfo ? (
          <div
            className="mt-4 border-t border-ledgerBorder pt-3"
            data-testid="order-committed"
          >
            <p className="flex items-center gap-2 text-[16px] font-semibold leading-6 text-paid">
              <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
              {committedInfo.message}
            </p>
            {/* Undo is only offered on the most recent turn; sending a new
                message makes this card no longer live and locks it for good. */}
            {canShowResaveControls ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={resaveDisabled}
                    className="h-10 rounded bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={() => void handleResaveOrder()}
                  >
                    {isResaving ? "Đang ghi lại..." : "Ghi lại"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isResaving}
                    className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleCancelEditOrder}
                  >
                    Huỷ sửa
                  </Button>
                </div>
                {!state.canConfirm ? (
                  <p className="mt-2 text-[15px] leading-6 text-textMute">
                    Còn thiếu thông tin, bác bổ sung giúp em ạ.
                  </p>
                ) : null}
                {resaveError ? (
                  <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                    {resaveError}
                  </p>
                ) : null}
              </div>
            ) : canShowUndoButton ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {canShowEditOrderButton ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={handleStartEditOrder}
                  >
                    Sửa Đơn
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUndoing}
                  className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={() => void handleUndo()}
                >
                  {isUndoing ? "Đang huỷ..." : "Hoàn tác"}
                </Button>
                {undoError ? (
                  <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                    {undoError}
                  </p>
                ) : null}
                {resaveError ? (
                  <p className="basis-full text-[15px] leading-6 text-debt" role="alert">
                    {resaveError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : isRestored ? (
          <div className="mt-4 border-t border-ledgerBorder pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={restoredCommitDisabled}
                title={
                  state.canConfirm
                    ? "Ghi vào sổ ạ"
                    : "Còn thiếu thông tin, bác bỏ nháp rồi tạo lại giúp em ạ."
                }
                className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                onClick={handleConfirmClick}
              >
                {isCommitting ? "Đang ghi đơn..." : buttonLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={dismissDisabled}
                className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                onClick={handleDismissPreview}
              >
                Bỏ
              </Button>
            </div>
            {!state.canConfirm ? (
              <p className="mt-2 text-[15px] leading-6 text-textMute">
                Còn thiếu thông tin, bác bỏ nháp rồi tạo lại giúp em ạ.
              </p>
            ) : null}
            {commitError ? (
              <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                {commitError}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-2 text-[15px] leading-6 text-stamp" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        ) : interactive ? (
          <div className="mt-4 border-t border-ledgerBorder pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={commitDisabled}
                title={
                  state.canConfirm
                    ? "Ghi vào sổ ạ"
                    : "Còn thiếu thông tin, bác bổ sung giúp em ạ."
                }
                className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                onClick={handleConfirmClick}
              >
                {isCommitting ? "Đang ghi đơn..." : buttonLabel}
              </Button>
              {canDismissPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={dismissDisabled}
                  className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={handleDismissPreview}
                >
                  Bỏ
                </Button>
              ) : null}
            </div>
            {!state.canConfirm ? (
              <p className="mt-2 text-[15px] leading-6 text-textMute">
                Còn thiếu thông tin, bác bổ sung giúp em ạ.
              </p>
            ) : null}
            {commitError ? (
              <p className="mt-2 text-[15px] leading-6 text-debt" role="alert">
                {commitError}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-2 text-[15px] leading-6 text-stamp" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        ) : null}
        <DeleteOrderConfirmModal
          open={deleteOrderConfirmOpen}
          summary={deleteOrderSummary}
          isUndoing={isUndoing}
          undoError={undoError}
          onConfirm={handleUndo}
          onCancel={handleCloseDeleteOrderConfirm}
        />
      </article>
    </div>
  );
}
