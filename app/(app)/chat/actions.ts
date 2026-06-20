"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/src/types/action-result";
import type { ChatMessageView } from "@/src/components/chat/types";
import {
  historyCustomerCardContent,
  historyProductCardContent,
  parseHistoryCommitCard,
  parseHistoryCustomerCard,
  parseHistoryProductCard,
  type HistoryCommitCard,
  type HistoryCustomerCard,
  type HistoryProductCard,
} from "@/src/lib/chat/history-card";
import type {
  CustomerManagementPreview,
  ProductManagementCandidate,
  ProductManagementPreview,
  ProductManagementProduct,
  ProductManagementTarget,
  ProductManagementUpdateAction,
} from "@/src/components/chat/preview-card/types";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import {
  runChatPipeline,
  type ChatPipelineResult,
} from "@/src/lib/ai/chat-pipeline";
import { checkAiGuard } from "@/src/lib/ai/cost-guard";
import {
  logAiInteraction,
  updateAiInteractionOutcome,
} from "@/src/lib/ai/interaction-log";
import {
  answerQuery,
  type QueryAnswer,
} from "@/src/lib/ai/answer-query";
import {
  commitConfirmationMessage,
  friendlyNoneMessage,
  queryAnswerToText,
} from "@/src/lib/ai/terminal-text";
import {
  capabilityReply,
  detectCapabilityQuestion,
} from "@/src/lib/ai/capability-help";
import { generateSmallTalkReply } from "@/src/lib/ai/small-talk-reply";
import { resolveOne, type EntityRow } from "@/src/lib/ai/entity-resolver";
import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import type {
  CustomerManagement,
  ProductManagement,
} from "@/src/lib/ai/intent-schema";
import {
  parseProductSellPriceInput,
  validateProductUpdatePatch,
  type ProductSellPriceInput,
  type ProductUpdateInput,
} from "@/src/lib/products/update";
import { createClient } from "@/src/lib/supabase/server";
import { businessDateVN } from "@/src/lib/dayjs";

const MAX_MESSAGE_LENGTH = 2000;

type ProductManagementSupabaseClient = Pick<SupabaseClient, "from">;
type CustomerManagementSupabaseClient = Pick<SupabaseClient, "from">;
type HistoryCardSupabaseClient = Pick<SupabaseClient, "from">;

type InsertedChatRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type CustomerRow = {
  id: string;
  name: string;
};

type CustomerSearchRow = CustomerRow & {
  aliases: string[] | null;
  phone?: string | null;
};

type CustomerPhoneRow = CustomerRow & {
  phone: string | null;
};

type SupplierRow = {
  id: string;
  name: string;
};

type SupplierSearchRow = SupplierRow & {
  aliases: string[] | null;
};

type ProductRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | string | null;
};

type ProductSearchRow = {
  id: string;
  name: string;
  unit: string | null;
  sell_price: number | string | null;
  aliases: string[] | null;
};

type ProductManagementSearchRow = ProductSearchRow & {
  sell_price: number | string | null;
};

type ProductUpdateRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | string | null;
};

type ProductDeleteRow = ProductUpdateRow & {
  name: string;
};

export type CreatedCustomerView = CustomerRow;
export type CreatedSupplierView = SupplierRow;
export type CreatedProductView = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
};
export type UpdatedProductView = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
};
export type UpdatedCustomerView = CustomerRow;
export type UpdatedCustomerPhoneView = CustomerRow & {
  phone: string;
};

export type ProcessMessageResult =
  | {
      ok: true;
      userMessage: ChatMessageView;
      pipeline: ChatPipelineResult;
      answer?: QueryAnswer | null;
      customerManagementPreview?: CustomerManagementPreview | null;
      productManagementPreview?: ProductManagementPreview | null;
      terminalText?: string | null;
      turnId?: string;
    }
  | { ok: false; code: string; message: string };

function toUserMessage(row: InsertedChatRow): ChatMessageView {
  return {
    id: row.id,
    role: "user",
    content: row.content,
    created_at: row.created_at,
  };
}

async function persistAssistantTerminalMessage({
  supabase,
  ownerId,
  content,
  intent,
  metadata,
  source = "tip_18a",
}: {
  supabase: Pick<SupabaseClient, "from">;
  ownerId: string;
  content: string;
  intent: string;
  metadata?: Record<string, unknown>;
  source?: string;
}) {
  try {
    const { error } = await supabase.from("chat_messages").insert({
      owner_id: ownerId,
      role: "assistant",
      content,
      intent,
      metadata: {
        ...(metadata ?? {}),
        source,
      },
    });

    if (error) {
      console.warn("Failed to persist assistant terminal chat message", {
        code: error.code,
        message: error.message,
      });
    }
  } catch (error) {
    console.warn("Failed to persist assistant terminal chat message", error);
  }
}

type DismissiblePreviewIntent =
  | "create_order"
  | "record_payment"
  | "create_purchase";

function isDismissiblePreviewIntent(
  intent: string,
): intent is DismissiblePreviewIntent {
  return (
    intent === "create_order" ||
    intent === "record_payment" ||
    intent === "create_purchase"
  );
}

export async function persistDismissedPreviewMessage(
  input: Readonly<{
    intent: string;
    content: string;
    card: unknown;
    ai_turn_id?: string;
  }>,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (!isDismissiblePreviewIntent(input.intent)) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Thẻ này không hỗ trợ bỏ ạ.",
    };
  }

  const card = parseHistoryCommitCard({ card: input.card });

  await persistAssistantTerminalMessage({
    supabase,
    ownerId: user.id,
    content: input.content,
    intent: input.intent,
    metadata: card ? { card } : undefined,
    source: "tip_22_dismiss",
  });

  await updateAiInteractionOutcome({
    supabase,
    ownerId: user.id,
    aiTurnId: input.ai_turn_id,
    outcome: "dismissed",
  });

  return { ok: true, data: null };
}

export async function persistProductManagementMessage(
  input: Readonly<{
    card: unknown;
    content: string;
  }>,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  const card = parseHistoryProductCard({ card: input.card });
  const content = input.content.trim();

  if (!card || content.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Thẻ quản lý hàng chưa hợp lệ ạ.",
    };
  }

  await persistAssistantTerminalMessage({
    supabase,
    ownerId: user.id,
    content,
    intent: "manage_product",
    metadata: { card },
    source: "tip_33_product",
  });

  return { ok: true, data: null };
}

export async function persistCustomerManagementMessage(
  input: Readonly<{
    card: unknown;
    content: string;
  }>,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  const card = parseHistoryCustomerCard({ card: input.card });
  const content = input.content.trim();

  if (!card || content.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Thẻ quản lý khách chưa hợp lệ ạ.",
    };
  }

  await persistAssistantTerminalMessage({
    supabase,
    ownerId: user.id,
    content,
    intent: "manage_customer",
    metadata: { card },
    source: "tip_34_customer",
  });

  return { ok: true, data: null };
}

type HistoryCardBuildInput =
  | {
      kind: "create_order" | "edit_order";
      ownerId: string;
      sourceId: string;
      supabase: HistoryCardSupabaseClient;
    }
  | {
      kind: "record_payment";
      ownerId: string;
      sourceId: string;
      supabase: HistoryCardSupabaseClient;
    }
  | {
      kind: "create_purchase";
      ownerId: string;
      sourceId: string;
      supabase: HistoryCardSupabaseClient;
    };

type EntityNameRow = {
  name: string | null;
};

type OrderHistoryRow = {
  customer_id: string | null;
  business_date: string | null;
  total_amount: number | string | null;
  debt_amount: number | string | null;
};

type OrderItemHistoryRow = {
  product_name_snapshot: string | null;
  unit_snapshot: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  line_total: number | string | null;
};

type PaymentHistoryRow = {
  customer_id: string | null;
  amount: number | string | null;
};

type PurchaseHistoryRow = {
  supplier_id: string | null;
  business_date: string | null;
  total_amount: number | string | null;
};

type PurchaseItemHistoryRow = {
  product_name_snapshot: string | null;
  unit_snapshot: string | null;
  quantity: number | string | null;
  unit_cost: number | string | null;
  line_total: number | string | null;
};

function toFiniteNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function requiredHistoryNumber(
  value: number | string | null | undefined,
  field: string,
) {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    throw new Error(`Invalid history card number: ${field}`);
  }

  return numberValue;
}

async function fetchHistoryEntityName(
  supabase: HistoryCardSupabaseClient,
  table: "customers" | "suppliers",
  ownerId: string,
  entityId: string | null,
) {
  if (!entityId) {
    return null;
  }

  const { data, error } = await supabase
    .from(table)
    .select("name")
    .eq("owner_id", ownerId)
    .eq("id", entityId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as EntityNameRow | null;
  return typeof row?.name === "string" ? row.name : null;
}

async function buildOrderHistoryCommitCard(
  input: Extract<HistoryCardBuildInput, { kind: "create_order" | "edit_order" }>,
): Promise<HistoryCommitCard | null> {
  const { data, error } = await input.supabase
    .from("orders")
    .select("customer_id,business_date,total_amount,debt_amount")
    .eq("owner_id", input.ownerId)
    .eq("id", input.sourceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const order = data as OrderHistoryRow | null;

  if (!order) {
    return null;
  }

  const { data: itemsData, error: itemsError } = await input.supabase
    .from("order_items")
    .select("product_name_snapshot,unit_snapshot,quantity,unit_price,line_total,sort_order")
    .eq("owner_id", input.ownerId)
    .eq("order_id", input.sourceId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const entityName = await fetchHistoryEntityName(
    input.supabase,
    "customers",
    input.ownerId,
    order.customer_id,
  );

  return {
    v: 1,
    kind: input.kind,
    entity_name: entityName,
    business_date:
      typeof order.business_date === "string" ? order.business_date : null,
    total_amount: toFiniteNumber(order.total_amount),
    debt_amount: toFiniteNumber(order.debt_amount),
    amount: null,
    items: ((itemsData ?? []) as OrderItemHistoryRow[]).map((item) => ({
      name: item.product_name_snapshot ?? "Hàng",
      quantity: requiredHistoryNumber(item.quantity, "order_items.quantity"),
      unit: item.unit_snapshot ?? "",
      unit_price: requiredHistoryNumber(item.unit_price, "order_items.unit_price"),
      line_total: requiredHistoryNumber(item.line_total, "order_items.line_total"),
    })),
    source_id: input.sourceId,
  };
}

async function buildPaymentHistoryCommitCard(
  input: Extract<HistoryCardBuildInput, { kind: "record_payment" }>,
): Promise<HistoryCommitCard | null> {
  const { data, error } = await input.supabase
    .from("payments")
    .select("customer_id,amount")
    .eq("owner_id", input.ownerId)
    .eq("id", input.sourceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const payment = data as PaymentHistoryRow | null;

  if (!payment) {
    return null;
  }

  const entityName = await fetchHistoryEntityName(
    input.supabase,
    "customers",
    input.ownerId,
    payment.customer_id,
  );

  return {
    v: 1,
    kind: input.kind,
    entity_name: entityName,
    business_date: null,
    total_amount: null,
    debt_amount: null,
    amount: toFiniteNumber(payment.amount),
    items: null,
    source_id: input.sourceId,
  };
}

async function buildPurchaseHistoryCommitCard(
  input: Extract<HistoryCardBuildInput, { kind: "create_purchase" }>,
): Promise<HistoryCommitCard | null> {
  const { data, error } = await input.supabase
    .from("purchases")
    .select("supplier_id,business_date,total_amount")
    .eq("owner_id", input.ownerId)
    .eq("id", input.sourceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const purchase = data as PurchaseHistoryRow | null;

  if (!purchase) {
    return null;
  }

  const { data: itemsData, error: itemsError } = await input.supabase
    .from("purchase_items")
    .select("product_name_snapshot,unit_snapshot,quantity,unit_cost,line_total,sort_order")
    .eq("owner_id", input.ownerId)
    .eq("purchase_id", input.sourceId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const entityName = await fetchHistoryEntityName(
    input.supabase,
    "suppliers",
    input.ownerId,
    purchase.supplier_id,
  );

  return {
    v: 1,
    kind: input.kind,
    entity_name: entityName,
    business_date:
      typeof purchase.business_date === "string" ? purchase.business_date : null,
    total_amount: toFiniteNumber(purchase.total_amount),
    debt_amount: null,
    amount: null,
    items: ((itemsData ?? []) as PurchaseItemHistoryRow[]).map((item) => ({
      name: item.product_name_snapshot ?? "Hàng",
      quantity: requiredHistoryNumber(item.quantity, "purchase_items.quantity"),
      unit: item.unit_snapshot ?? "",
      unit_price: requiredHistoryNumber(item.unit_cost, "purchase_items.unit_cost"),
      line_total: requiredHistoryNumber(item.line_total, "purchase_items.line_total"),
    })),
    source_id: input.sourceId,
  };
}

async function buildHistoryCommitCardSnapshot(
  input: HistoryCardBuildInput,
): Promise<HistoryCommitCard | null> {
  try {
    if (input.kind === "record_payment") {
      return await buildPaymentHistoryCommitCard(input);
    }

    if (input.kind === "create_purchase") {
      return await buildPurchaseHistoryCommitCard(input);
    }

    return await buildOrderHistoryCommitCard(input);
  } catch (error) {
    console.warn("Failed to build history commit card snapshot", error);
    return null;
  }
}

function metadataWithHistoryCard(
  metadata: Record<string, unknown>,
  card: HistoryCommitCard | null,
) {
  return card ? { ...metadata, card } : metadata;
}

async function persistTerminalAssistantResponse({
  supabase,
  ownerId,
  pipeline,
  answer,
}: {
  supabase: Pick<SupabaseClient, "from">;
  ownerId: string;
  pipeline: ChatPipelineResult;
  answer: QueryAnswer | null;
}): Promise<string | null> {
  if (!pipeline.ok) {
    return null;
  }

  if (
    pipeline.validated.kind === "none" &&
    (pipeline.validated.intent === "small_talk" ||
      pipeline.validated.intent === "unknown")
  ) {
    const capabilityCategory = detectCapabilityQuestion(
      pipeline.validated.raw_text,
    );

    if (capabilityCategory) {
      const reply = capabilityReply(capabilityCategory);

      await persistAssistantTerminalMessage({
        supabase,
        ownerId,
        content: reply.content,
        intent: pipeline.validated.intent,
        metadata: {
          chips: reply.chips,
        },
        source: "tip_25a_capability",
      });
      return null;
    }

    if (pipeline.validated.intent === "small_talk") {
      const llmReply = await generateSmallTalkReply({
        rawText: pipeline.validated.raw_text,
      });

      if (llmReply) {
        await persistAssistantTerminalMessage({
          supabase,
          ownerId,
          content: llmReply,
          intent: "small_talk",
          source: "tip_25b_small_talk",
        });
        return llmReply;
      }
    }

    const fallbackText = friendlyNoneMessage(pipeline.validated.intent);

    if (fallbackText) {
      await persistAssistantTerminalMessage({
        supabase,
        ownerId,
        content: fallbackText,
        intent: pipeline.validated.intent,
      });
    }

    return null;
  }

  if (answer) {
    await persistAssistantTerminalMessage({
      supabase,
      ownerId,
      content: queryAnswerToText(answer),
      intent: "query",
      metadata: {
        query_subject: answer.type,
      },
    });
  }

  return null;
}

function normalizeCustomerName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function findCustomerByName(rows: CustomerRow[] | null, name: string) {
  const normalized = normalizeCustomerName(name);

  return (rows ?? []).find(
    (row) => normalizeCustomerName(row.name) === normalized,
  ) ?? null;
}

function normalizeSupplierName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function findSupplierByName(rows: SupplierRow[] | null, name: string) {
  const normalized = normalizeSupplierName(name);

  return (rows ?? []).find(
    (row) => normalizeSupplierName(row.name) === normalized,
  ) ?? null;
}

function normalizeProductName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function findProductByName(rows: ProductRow[] | null, name: string) {
  const normalized = normalizeProductName(name);

  return (rows ?? []).find(
    (row) => normalizeProductName(row.name) === normalized,
  ) ?? null;
}

function normalizeCustomerSearchRows(rows: CustomerSearchRow[] | null): EntityRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  }));
}

function normalizeSupplierSearchRows(rows: SupplierSearchRow[] | null): EntityRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  }));
}

function normalizeProductSearchRows(rows: ProductSearchRow[] | null): EntityRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sell_price: nullableProductMoney(row.sell_price),
    unit:
      typeof row.unit === "string" && row.unit.trim().length > 0
        ? row.unit
        : null,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  }));
}

function productManagementProductFromRow(
  row: ProductManagementSearchRow,
): ProductManagementProduct {
  return {
    id: row.id,
    name: row.name,
    unit:
      typeof row.unit === "string" && row.unit.trim().length > 0
        ? row.unit
        : null,
    sell_price: nullableProductMoney(row.sell_price),
  };
}

function normalizeProductManagementRows(
  rows: ProductManagementSearchRow[] | null,
) {
  const entityRows: EntityRow[] = [];
  const productsById = new Map<string, ProductManagementProduct>();

  for (const row of rows ?? []) {
    const product = productManagementProductFromRow(row);

    productsById.set(row.id, product);
    entityRows.push({
      id: row.id,
      name: row.name,
      unit: product.unit,
      aliases: Array.isArray(row.aliases)
        ? row.aliases.filter((alias): alias is string => typeof alias === "string")
        : [],
    });
  }

  return { entityRows, productsById };
}

function nullableProductMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

function productManagementTarget(
  productManagement: ProductManagement | null,
):
  | {
      action: ProductManagementUpdateAction;
      productRaw: string;
      target: ProductManagementTarget;
    }
  | {
      action: "delete";
      productRaw: string;
    }
  | null {
  const productRaw = productManagement?.product_raw.trim() ?? "";

  if (!productManagement || productRaw.length === 0) {
    return null;
  }

  if (productManagement.action === "set_unit") {
    const unit = productManagement.unit?.trim() ?? "";

    return unit.length > 0
      ? {
          action: "set_unit",
          productRaw,
          target: { unit },
        }
      : null;
  }

  if (productManagement.action === "set_price") {
    const sellPrice = productManagement.sell_price;

    return typeof sellPrice === "number" && Number.isFinite(sellPrice) && sellPrice >= 0
      ? {
          action: "set_price",
          productRaw,
          target: { sell_price: Math.round(sellPrice) },
        }
      : null;
  }

  if (productManagement.action === "delete") {
    return {
      action: "delete",
      productRaw,
    };
  }

  return null;
}

function productManagementCreatePreview(
  productManagement: ProductManagement | null,
): Extract<ProductManagementPreview, { status: "create_draft" }> | null {
  if (!productManagement || productManagement.action !== "create") {
    return null;
  }

  const productRaw = productManagement.product_raw.trim();

  if (productRaw.length === 0) {
    return null;
  }

  const unit = productManagement.unit?.trim() || "cái";
  const sellPrice = productManagement.sell_price;

  return {
    status: "create_draft",
    action: "create",
    product_raw: productRaw,
    draft: {
      name: productRaw,
      unit,
      sell_price:
        typeof sellPrice === "number" && Number.isFinite(sellPrice)
          ? Math.round(sellPrice)
          : null,
    },
  };
}

function productManagementDuplicatePreview(
  productRaw: string,
  product: ProductRow,
): Extract<ProductManagementPreview, { status: "create_duplicate" }> {
  const productView = createdProductView(product);

  return {
    status: "create_duplicate",
    action: "create",
    product_raw: productRaw,
    product: productView,
  };
}

function productManagementCandidate(
  candidate: ResolvedEntity["candidates"][number],
  productsById: Map<string, ProductManagementProduct>,
): ProductManagementCandidate {
  const product = productsById.get(candidate.id);

  return {
    ...candidate,
    unit: product?.unit ?? candidate.unit ?? null,
    sell_price: product?.sell_price ?? null,
  };
}

async function resolveProductManagementPreview({
  productManagement,
  ownerId,
  supabase,
}: {
  productManagement: ProductManagement | null;
  ownerId: string;
  supabase: ProductManagementSupabaseClient;
}): Promise<ActionResult<ProductManagementPreview | null>> {
  const createPreview = productManagementCreatePreview(productManagement);

  if (createPreview) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,unit,sell_price")
      .eq("owner_id", ownerId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error) {
      return {
        ok: false,
        code: "db_error",
        message: "Chưa kiểm được hàng, bác thử lại ạ.",
      };
    }

    const existing = findProductByName(
      data as ProductRow[] | null,
      createPreview.product_raw,
    );

    if (existing) {
      return {
        ok: true,
        data: productManagementDuplicatePreview(
          createPreview.product_raw,
          existing,
        ),
      };
    }

    return { ok: true, data: createPreview };
  }

  const target = productManagementTarget(productManagement);

  if (!target) {
    return { ok: true, data: null };
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,aliases,unit,sell_price")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa tìm được hàng, bác thử lại ạ.",
    };
  }

  const { entityRows, productsById } = normalizeProductManagementRows(
    data as ProductManagementSearchRow[] | null,
  );
  const resolution = resolveOne(target.productRaw, "product", entityRows);

  if (resolution.status === "not_found") {
    return {
      ok: true,
      data: {
        status: "not_found",
        action: target.action,
        product_raw: target.productRaw,
      },
    };
  }

  if (resolution.status === "resolved" && resolution.resolved_id) {
    const product = productsById.get(resolution.resolved_id);

    if (product) {
      return {
        ok: true,
        data:
          target.action === "delete"
            ? {
                status: "confirm_delete",
                action: "delete",
                product,
              }
            : {
                status: "ready",
                action: target.action,
                product,
                target: target.target,
              },
      };
    }
  }

  const candidates = resolution.candidates.map((candidate) =>
    productManagementCandidate(candidate, productsById),
  );

  if (candidates.length === 0) {
    return {
      ok: true,
      data: {
        status: "not_found",
        action: target.action,
        product_raw: target.productRaw,
      },
    };
  }

  return {
    ok: true,
    data:
      target.action === "delete"
        ? {
            status: "needs_choice",
            action: "delete",
            product_raw: target.productRaw,
            candidates,
          }
        : {
            status: "needs_choice",
            action: target.action,
            product_raw: target.productRaw,
            candidates,
            target: target.target,
          },
  };
}

function terminalHistoryProductCard(
  preview: ProductManagementPreview | null,
): HistoryProductCard | null {
  if (preview?.status === "create_duplicate") {
    return {
      v: 1,
      kind: "manage_product",
      action: "create",
      status: "create_duplicate",
      product_name: preview.product.name,
      product_raw: preview.product_raw,
      unit: preview.product.unit,
      sell_price: preview.product.sell_price,
    };
  }

  if (preview?.status === "not_found") {
    return {
      v: 1,
      kind: "manage_product",
      action: preview.action,
      status: "not_found",
      product_name: null,
      product_raw: preview.product_raw,
      unit: null,
      sell_price: null,
    };
  }

  return null;
}

async function persistTerminalProductManagementPreview({
  supabase,
  ownerId,
  preview,
}: {
  supabase: Pick<SupabaseClient, "from">;
  ownerId: string;
  preview: ProductManagementPreview | null;
}) {
  const card = terminalHistoryProductCard(preview);

  if (!card) {
    return;
  }

  await persistAssistantTerminalMessage({
    supabase,
    ownerId,
    content: historyProductCardContent(card),
    intent: "manage_product",
    metadata: { card },
    source: "tip_33_product",
  });
}

async function resolveCustomerManagementPreview({
  customerManagement,
  ownerId,
  supabase,
}: {
  customerManagement: CustomerManagement | null;
  ownerId: string;
  supabase: CustomerManagementSupabaseClient;
}): Promise<ActionResult<CustomerManagementPreview | null>> {
  if (!customerManagement) {
    return { ok: true, data: null };
  }

  const customerRaw = customerManagement.customer_raw.trim();

  if (customerManagement.action === "set_phone") {
    const phoneRaw = customerManagement.phone_raw?.trim() ?? "";

    if (customerRaw.length === 0 || phoneRaw.length === 0) {
      return {
        ok: true,
        data: {
          status: "not_found",
          action: "set_phone",
          customer_raw: customerRaw,
          phone_raw: phoneRaw || null,
        },
      };
    }

    const { data, error } = await supabase
      .from("customers")
      .select("id,name,aliases,phone")
      .eq("owner_id", ownerId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error) {
      return {
        ok: false,
        code: "db_error",
        message: "Chưa tìm được khách, bác thử lại ạ.",
      };
    }

    const rows = data as CustomerSearchRow[] | null;
    const customersById = new Map(
      (rows ?? []).map((row) => [
        row.id,
        { id: row.id, name: row.name, phone: row.phone ?? null },
      ]),
    );
    const resolution = resolveOne(
      customerRaw,
      "customer",
      normalizeCustomerSearchRows(rows),
    );

    if (resolution.status === "not_found") {
      return {
        ok: true,
        data: {
          status: "not_found",
          action: "set_phone",
          customer_raw: customerRaw,
          phone_raw: phoneRaw,
        },
      };
    }

    if (resolution.status === "resolved" && resolution.resolved_id) {
      const customer = customersById.get(resolution.resolved_id);

      if (customer) {
        return {
          ok: true,
          data: {
            status: "confirm_set_phone",
            action: "set_phone",
            customer: { id: customer.id, name: customer.name },
            phone_raw: phoneRaw,
            current_phone: customer.phone,
          },
        };
      }
    }

    const candidates = resolution.candidates
      .map((candidate) => customersById.get(candidate.id))
      .filter((candidate): candidate is CustomerPhoneRow => Boolean(candidate))
      .map(({ id, name }) => ({ id, name }));

    if (candidates.length === 0) {
      return {
        ok: true,
        data: {
          status: "not_found",
          action: "set_phone",
          customer_raw: customerRaw,
          phone_raw: phoneRaw,
        },
      };
    }

    return {
      ok: true,
      data: {
        status: "needs_choice",
        action: "set_phone",
        customer_raw: customerRaw,
        phone_raw: phoneRaw,
        candidates,
      },
    };
  }

  const newName = customerManagement.new_name?.trim() ?? "";

  if (customerRaw.length === 0 || newName.length === 0) {
    return {
      ok: true,
      data: {
        status: "not_found",
        action: "rename",
        customer_raw: customerRaw,
        new_name: newName || null,
      },
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id,name,aliases")
    .eq("owner_id", ownerId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa tìm được khách, bác thử lại ạ.",
    };
  }

  const rows = data as CustomerSearchRow[] | null;
  const customersById = new Map(
    (rows ?? []).map((row) => [row.id, { id: row.id, name: row.name }]),
  );
  const resolution = resolveOne(
    customerRaw,
    "customer",
    normalizeCustomerSearchRows(rows),
  );

  if (resolution.status === "not_found") {
    return {
      ok: true,
      data: {
        status: "not_found",
        action: "rename",
        customer_raw: customerRaw,
        new_name: newName,
      },
    };
  }

  if (resolution.status === "resolved" && resolution.resolved_id) {
    const customer = customersById.get(resolution.resolved_id);

    if (customer) {
      return {
        ok: true,
        data: {
          status: "confirm_rename",
          action: "rename",
          customer,
          new_name: newName,
        },
      };
    }
  }

  const candidates = resolution.candidates
    .map((candidate) => customersById.get(candidate.id))
    .filter((candidate): candidate is CustomerRow => Boolean(candidate));

  if (candidates.length === 0) {
    return {
      ok: true,
      data: {
        status: "not_found",
        action: "rename",
        customer_raw: customerRaw,
        new_name: newName,
      },
    };
  }

  return {
    ok: true,
    data: {
      status: "needs_choice",
      action: "rename",
      customer_raw: customerRaw,
      new_name: newName,
      candidates,
    },
  };
}

function terminalHistoryCustomerCard(
  preview: CustomerManagementPreview | null,
): HistoryCustomerCard | null {
  if (preview?.status !== "not_found") {
    return null;
  }

  if (preview.action === "set_phone") {
    return {
      v: 1,
      kind: "manage_customer",
      action: "set_phone",
      status: "not_found",
      customer_name: null,
      customer_raw: preview.customer_raw,
      new_name: null,
      phone_raw: preview.phone_raw,
    };
  }

  return {
    v: 1,
    kind: "manage_customer",
    action: "rename",
    status: "not_found",
    customer_name: null,
    customer_raw: preview.customer_raw,
    new_name: preview.new_name,
    phone_raw: null,
  };
}

async function persistTerminalCustomerManagementPreview({
  supabase,
  ownerId,
  preview,
}: {
  supabase: Pick<SupabaseClient, "from">;
  ownerId: string;
  preview: CustomerManagementPreview | null;
}) {
  const card = terminalHistoryCustomerCard(preview);

  if (!card) {
    return;
  }

  await persistAssistantTerminalMessage({
    supabase,
    ownerId,
    content: historyCustomerCardContent(card),
    intent: "manage_customer",
    metadata: { card },
    source: "tip_34_customer",
  });
}

function createdProductView(row: ProductRow): CreatedProductView {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    sell_price: nullableProductMoney(row.sell_price),
  };
}

function isUniqueViolation(error: { code?: string; message?: string } | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "23505" ||
    error.message?.toLowerCase().includes("duplicate") === true
  );
}

export async function sendMessage(
  content: string,
): Promise<ActionResult<ChatMessageView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof content !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Bác chưa nhập gì ạ.",
    };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Bác chưa nhập gì ạ.",
    };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tin hơi dài, bác rút gọn dưới 2000 chữ giúp em ạ.",
    };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      owner_id: user.id,
      role: "user",
      content: trimmed,
      intent: null,
      metadata: { source: "chat_ui_scaffold" },
    })
    .select("id,role,content,created_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa lưu được tin, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: toUserMessage(data as InsertedChatRow),
  };
}

export async function createCustomer(
  name: string,
): Promise<ActionResult<CreatedCustomerView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const existingRead = await supabase
    .from("customers")
    .select("id,name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được khách, bác thử lại ạ.",
    };
  }

  const existing = findCustomerByName(
    existingRead.data as CustomerRow[] | null,
    trimmed,
  );

  if (existing) {
    return {
      ok: true,
      data: existing,
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      name: trimmed,
    })
    .select("id,name")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const retryRead = await supabase
        .from("customers")
        .select("id,name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!retryRead.error) {
        const duplicate = findCustomerByName(
          retryRead.data as CustomerRow[] | null,
          trimmed,
        );

        if (duplicate) {
          return {
            ok: true,
            data: duplicate,
          };
        }
      }

      return {
        ok: false,
        code: "validation_failed",
        message: "Khách này có rồi ạ.",
      };
    }

    return {
      ok: false,
      code: "db_error",
      message: "Chưa thêm được khách, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: data as CustomerRow,
  };
}

export async function updateCustomer(
  customerId: string,
  patch: { name: string },
): Promise<ActionResult<UpdatedCustomerView>> {
  if (typeof customerId !== "string" || customerId.trim().length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa.",
    };
  }

  if (!patch || typeof patch.name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const trimmedName = patch.name.trim();

  if (trimmedName.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách chưa hợp lệ ạ.",
    };
  }

  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const trimmedCustomerId = customerId.trim();

  const { data: beforeData, error: beforeError } = await supabase
    .from("customers")
    .select("id,name")
    .eq("owner_id", user.id)
    .eq("id", trimmedCustomerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (beforeError) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa đọc được khách, bác thử lại ạ.",
    };
  }

  if (!beforeData) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa.",
    };
  }

  const before = beforeData as CustomerRow;

  if (normalizeCustomerName(before.name) === normalizeCustomerName(trimmedName)) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên mới đang trùng tên cũ ạ.",
    };
  }

  const existingRead = await supabase
    .from("customers")
    .select("id,name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được khách trùng tên, bác thử lại ạ.",
    };
  }

  const duplicate = findCustomerByName(
    existingRead.data as CustomerRow[] | null,
    trimmedName,
  );

  if (duplicate && duplicate.id !== trimmedCustomerId) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên khách này đã có rồi ạ.",
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .update({ name: trimmedName })
    .eq("owner_id", user.id)
    .eq("id", trimmedCustomerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("id,name")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa sửa được khách, bác thử lại ạ.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa.",
    };
  }

  const updated = data as CustomerRow;
  const { error: auditError } = await supabase.from("audit_log").insert({
    owner_id: user.id,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: updated.id,
    action: "update",
    before_data: { name: before.name },
    after_data: { name: updated.name },
    metadata: {
      fields: ["name"],
    },
  });

  if (auditError) {
    console.error("audit_log insert failed for updateCustomer", auditError);

    return {
      ok: false,
      code: "db_error",
      message: "Đã sửa khách nhưng chưa ghi được nhật ký, bác tải lại kiểm tra giúp em ạ.",
    };
  }

  return {
    ok: true,
    data: {
      id: updated.id,
      name: updated.name,
    },
  };
}

export async function updateCustomerPhone(
  customerId: string,
  phone: string,
): Promise<ActionResult<UpdatedCustomerPhoneView>> {
  if (typeof customerId !== "string" || customerId.trim().length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa SĐT.",
    };
  }

  if (typeof phone !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Số điện thoại không được rỗng.",
    };
  }

  const trimmedPhone = phone.trim();

  if (trimmedPhone.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Số điện thoại không được rỗng.",
    };
  }

  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const trimmedCustomerId = customerId.trim();

  const { data: beforeData, error: beforeError } = await supabase
    .from("customers")
    .select("id,name,phone")
    .eq("owner_id", user.id)
    .eq("id", trimmedCustomerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (beforeError) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa đọc được khách, bác thử lại ạ.",
    };
  }

  if (!beforeData) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa SĐT.",
    };
  }

  const before = beforeData as CustomerPhoneRow;
  const { data, error } = await supabase
    .from("customers")
    .update({ phone: trimmedPhone })
    .eq("owner_id", user.id)
    .eq("id", trimmedCustomerId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("id,name,phone")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Lỗi cập nhật SĐT.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy khách để sửa SĐT.",
    };
  }

  const updated = data as CustomerPhoneRow;
  const { error: auditError } = await supabase.from("audit_log").insert({
    owner_id: user.id,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: updated.id,
    action: "update",
    before_data: { phone: before.phone },
    after_data: { phone: updated.phone },
    metadata: {
      fields: ["phone"],
    },
  });

  if (auditError) {
    console.error("audit_log insert failed for updateCustomerPhone", auditError);

    return {
      ok: false,
      code: "db_error",
      message:
        "Đã cập nhật SĐT nhưng chưa ghi được nhật ký, bác tải lại kiểm tra giúp em ạ.",
    };
  }

  return {
    ok: true,
    data: {
      id: updated.id,
      name: updated.name,
      phone: updated.phone ?? trimmedPhone,
    },
  };
}

export async function searchCustomersByName(
  name: string,
): Promise<ActionResult<ResolvedEntity>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i áº¡.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "TÃªn khÃ¡ch chÆ°a há»£p lá»‡ áº¡.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: true,
      data: resolveOne(null, "customer", []),
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id,name,aliases")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "ChÆ°a tÃ¬m Ä‘Æ°á»£c khÃ¡ch, bÃ¡c thá»­ láº¡i áº¡.",
    };
  }

  return {
    ok: true,
    data: resolveOne(
      trimmed,
      "customer",
      normalizeCustomerSearchRows(data as CustomerSearchRow[] | null),
    ),
  };
}

export async function createSupplier(
  name: string,
): Promise<ActionResult<CreatedSupplierView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên nhà cung cấp chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên nhà cung cấp chưa hợp lệ ạ.",
    };
  }

  const existingRead = await supabase
    .from("suppliers")
    .select("id,name")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được nhà cung cấp, bác thử lại ạ.",
    };
  }

  const existing = findSupplierByName(
    existingRead.data as SupplierRow[] | null,
    trimmed,
  );

  if (existing) {
    return {
      ok: true,
      data: existing,
    };
  }

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      owner_id: user.id,
      name: trimmed,
    })
    .select("id,name")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const retryRead = await supabase
        .from("suppliers")
        .select("id,name")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!retryRead.error) {
        const duplicate = findSupplierByName(
          retryRead.data as SupplierRow[] | null,
          trimmed,
        );

        if (duplicate) {
          return {
            ok: true,
            data: duplicate,
          };
        }
      }

      return {
        ok: false,
        code: "validation_failed",
        message: "Nhà cung cấp này có rồi ạ.",
      };
    }

    return {
      ok: false,
      code: "db_error",
      message: "Chưa thêm được nhà cung cấp, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: data as SupplierRow,
  };
}

export async function searchSuppliersByName(
  name: string,
): Promise<ActionResult<ResolvedEntity>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên nhà cung cấp chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: true,
      data: resolveOne(null, "supplier", []),
    };
  }

  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,aliases")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa tìm được nhà cung cấp, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: resolveOne(
      trimmed,
      "supplier",
      normalizeSupplierSearchRows(data as SupplierSearchRow[] | null),
    ),
  };
}

export async function createProduct(
  name: string,
  unit?: string,
  sell_price?: ProductSellPriceInput,
): Promise<ActionResult<CreatedProductView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên hàng chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên hàng chưa hợp lệ ạ.",
    };
  }

  const normalizedUnit =
    unit === undefined ? undefined : typeof unit === "string" ? unit.trim() : "";

  const parsedSellPrice = parseProductSellPriceInput(sell_price);

  if (!parsedSellPrice.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: parsedSellPrice.message,
    };
  }

  const existingRead = await supabase
    .from("products")
    .select("id,name,unit,sell_price")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được hàng, bác thử lại ạ.",
    };
  }

  const existing = findProductByName(
    existingRead.data as ProductRow[] | null,
    trimmed,
  );

  if (existing) {
    return {
      ok: true,
      data: createdProductView(existing),
    };
  }

  const insertPayload: {
    owner_id: string;
    name: string;
    unit?: string;
    sell_price?: number | null;
    is_active: true;
  } = {
    owner_id: user.id,
    name: trimmed,
    is_active: true,
  };

  if (normalizedUnit !== undefined) {
    insertPayload.unit = normalizedUnit;
  }

  if (sell_price !== undefined) {
    insertPayload.sell_price = parsedSellPrice.value;
  }

  const { data, error } = await supabase
    .from("products")
    .insert(insertPayload)
    .select("id,name,unit,sell_price")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error)) {
      const retryRead = await supabase
        .from("products")
        .select("id,name,unit,sell_price")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (!retryRead.error) {
        const duplicate = findProductByName(
          retryRead.data as ProductRow[] | null,
          trimmed,
        );

        if (duplicate) {
          return {
            ok: true,
            data: createdProductView(duplicate),
          };
        }
      }

      return {
        ok: false,
        code: "validation_failed",
        message: "Hàng này có rồi ạ.",
      };
    }

    return {
      ok: false,
      code: "db_error",
      message: "Chưa thêm được hàng, bác thử lại ạ.",
    };
  }

  const created = createdProductView(data as ProductRow);
  const { error: auditError } = await supabase.from("audit_log").insert({
    owner_id: user.id,
    actor_id: user.id,
    entity_type: "product",
    entity_id: created.id,
    action: "create",
    before_data: null,
    after_data: {
      name: created.name,
      unit: created.unit,
      sell_price: created.sell_price,
    },
    metadata: {
      source: "createProduct",
      fields: ["name", "unit", "sell_price"],
    },
  });

  if (auditError) {
    console.error("audit_log insert failed for createProduct", auditError);

    return {
      ok: false,
      code: "db_error",
      message: "Đã thêm hàng nhưng chưa ghi được nhật ký, bác tải lại kiểm tra giúp em ạ.",
    };
  }

  return {
    ok: true,
    data: created,
  };
}

export async function createProductFromChat(input: {
  name: string;
  unit: string;
  sell_price: ProductSellPriceInput;
}): Promise<ActionResult<CreatedProductView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (!input || typeof input.name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên hàng chưa hợp lệ ạ.",
    };
  }

  const trimmed = input.name.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên hàng chưa hợp lệ ạ.",
    };
  }

  const existingRead = await supabase
    .from("products")
    .select("id,name,unit,sell_price")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (existingRead.error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa kiểm được hàng, bác thử lại ạ.",
    };
  }

  const existing = findProductByName(
    existingRead.data as ProductRow[] | null,
    trimmed,
  );

  if (existing) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Hàng này có thể đã tồn tại. Bác kiểm tra lại danh sách hàng nhé.",
    };
  }

  return createProduct(trimmed, input.unit, input.sell_price);
}

export async function searchProductsByName(
  name: string,
): Promise<ActionResult<ResolvedEntity>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (typeof name !== "string") {
    return {
      ok: false,
      code: "validation_failed",
      message: "Tên hàng chưa hợp lệ ạ.",
    };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return {
      ok: true,
      data: resolveOne(null, "product", []),
    };
  }

  const { data, error } = await supabase
    .from("products")
    .select("id,name,aliases,unit,sell_price")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa tìm được hàng, bác thử lại ạ.",
    };
  }

  return {
    ok: true,
    data: resolveOne(
      trimmed,
      "product",
      normalizeProductSearchRows(data as ProductSearchRow[] | null),
    ),
  };
}

export async function updateProduct(
  productId: string,
  patch: ProductUpdateInput,
): Promise<ActionResult<UpdatedProductView>> {
  const validation = validateProductUpdatePatch(patch);

  if (!validation.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: validation.message,
    };
  }

  if (typeof productId !== "string" || productId.trim().length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để sửa.",
    };
  }

  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const trimmedProductId = productId.trim();

  const { data: beforeData, error: beforeError } = await supabase
    .from("products")
    .select("id,name,unit,sell_price")
    .eq("owner_id", user.id)
    .eq("id", trimmedProductId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (beforeError) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa đọc được hàng, bác thử lại ạ.",
    };
  }

  if (!beforeData) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để sửa.",
    };
  }

  const before = beforeData as ProductUpdateRow;

  if (validation.data.patch.name) {
    const existingRead = await supabase
      .from("products")
      .select("id,name,unit,sell_price")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (!existingRead.error) {
      const duplicate = findProductByName(
        existingRead.data as ProductRow[] | null,
        validation.data.patch.name,
      );

      if (duplicate && duplicate.id !== trimmedProductId) {
        return {
          ok: false,
          code: "validation_failed",
          message: "Đã có hàng tên này rồi ạ.",
        };
      }
    }
  }

  const { data, error } = await supabase
    .from("products")
    .update(validation.data.patch)
    .eq("owner_id", user.id)
    .eq("id", trimmedProductId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("id,name,unit,sell_price")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa sửa được hàng, bác thử lại ạ.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để sửa.",
    };
  }

  const updated = data as ProductUpdateRow;
  const beforeAudit = {
    name: before.name,
    unit: before.unit,
    sell_price: nullableProductMoney(before.sell_price),
  };
  const afterAudit = {
    name: updated.name,
    unit: updated.unit,
    sell_price: nullableProductMoney(updated.sell_price),
  };

  const { error: auditError } = await supabase.from("audit_log").insert({
    owner_id: user.id,
    actor_id: user.id,
    entity_type: "product",
    entity_id: updated.id,
    action: "update",
    before_data: beforeAudit,
    after_data: afterAudit,
    metadata: {
      fields: validation.data.fields,
    },
  });

  if (auditError) {
    console.error("audit_log insert failed for updateProduct", auditError);

    return {
      ok: false,
      code: "db_error",
      message: "Đã sửa hàng nhưng chưa ghi được nhật ký, bác tải lại kiểm tra giúp em ạ.",
    };
  }

  return {
    ok: true,
    data: {
      id: updated.id,
      name: updated.name,
      unit: updated.unit,
      sell_price: nullableProductMoney(updated.sell_price),
    },
  };
}

export async function deleteProduct(
  productId: string,
): Promise<ActionResult<ProductManagementProduct>> {
  if (typeof productId !== "string" || productId.trim().length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để xóa.",
    };
  }

  const user = await getAuthenticatedUser();
  const supabase = await createClient();
  const trimmedProductId = productId.trim();

  const { data: beforeData, error: beforeError } = await supabase
    .from("products")
    .select("id,name,unit,sell_price")
    .eq("owner_id", user.id)
    .eq("id", trimmedProductId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (beforeError) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa đọc được hàng, bác thử lại ạ.",
    };
  }

  if (!beforeData) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để xóa.",
    };
  }

  const before = beforeData as ProductDeleteRow;
  const deletedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("products")
    .update({
      deleted_at: deletedAt,
      is_active: false,
    })
    .eq("owner_id", user.id)
    .eq("id", trimmedProductId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("id,name,unit,sell_price")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa xóa được hàng, bác thử lại ạ.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Không tìm thấy hàng để xóa.",
    };
  }

  const deleted = data as ProductDeleteRow;
  const beforeAudit = {
    name: before.name,
    unit: before.unit,
    sell_price: nullableProductMoney(before.sell_price),
  };

  const { error: auditError } = await supabase.from("audit_log").insert({
    owner_id: user.id,
    actor_id: user.id,
    entity_type: "product",
    entity_id: deleted.id,
    action: "delete",
    before_data: beforeAudit,
    after_data: { deleted: true },
    metadata: {
      deleted_at: deletedAt,
    },
  });

  if (auditError) {
    console.error("audit_log insert failed for deleteProduct", auditError);

    return {
      ok: false,
      code: "db_error",
      message: "Đã xóa hàng nhưng chưa ghi được nhật ký, bác tải lại kiểm tra giúp em ạ.",
    };
  }

  return {
    ok: true,
    data: productManagementProductFromRow({
      ...deleted,
      aliases: null,
    }),
  };
}

export async function adjustProductStock(
  productId: string,
  newQuantity: number,
  note: string,
): Promise<ActionResult<{ adjusted: boolean; current_stock: number; delta: number }>> {
  if (typeof productId !== "string" || productId.trim().length === 0) {
    return { ok: false, code: "validation_failed", message: "Không tìm thấy hàng để kiểm kho." };
  }
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    return { ok: false, code: "validation_failed", message: "Số lượng không hợp lệ." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_product_stock", {
    p_product_id: productId.trim(),
    p_new_quantity: newQuantity,
    p_note: note.trim() || null,
  });

  if (error) {
    if (error.message?.includes("product_not_found")) {
      return { ok: false, code: "validation_failed", message: "Không tìm thấy hàng để kiểm kho." };
    }
    console.error("adjust_product_stock RPC failed", error);
    return { ok: false, code: "db_error", message: "Chưa điều chỉnh được tồn kho, bác thử lại ạ." };
  }

  const result = data as { adjusted: boolean; current_stock: number; delta: number };
  return { ok: true, data: result };
}

export type CommitOrderItemInput = Readonly<{
  product_id: string;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  quantity: number;
  unit_price: number;
}>;

export type CommitOrderInput = Readonly<{
  idempotency_key: string;
  customer_id: string;
  customer_name?: string | null;
  raw_input: string;
  business_date?: string | null;
  paid_amount?: number | null;
  ai_turn_id?: string;
  items: CommitOrderItemInput[];
}>;

export type CommitOrderView = {
  order_id: string;
  total_amount: number;
  debt_amount: number;
  business_date: string;
};

type CommitSaleOrderRpcResult = {
  order_id: string;
  total_amount: number | string;
  debt_amount: number | string;
  business_date?: string;
  idempotent_reuse?: boolean;
};

type RecreateSaleOrderErrorCode =
  | "unauthorized"
  | "validation_failed"
  | "db_error"
  | "not_found"
  | "not_editable"
  | "already_undone"
  | "recommit_failed";

export type RecreateSaleOrderInput = Readonly<{
  oldOrderId: string;
  idempotencyKey: string;
  customer_id: string;
  customer_name?: string | null;
  raw_input: string;
  items: CommitOrderItemInput[];
}>;

export type RecreateSaleOrderView = {
  newOrderId: string;
  total_amount: number;
  debt_amount: number;
  business_date: string;
};

export type RecreateSaleOrderResult =
  | { ok: true; data: RecreateSaleOrderView }
  | {
      ok: false;
      code: RecreateSaleOrderErrorCode;
      message: string;
      oldVoided?: boolean;
    };

type OriginalOrderRow = {
  business_date: string;
  status: string;
};

type BusinessDateRow = {
  business_date: string | null;
};

type RequestedBusinessDateResult =
  | { ok: true; businessDate: string }
  | { ok: false; message: string };

const ISO_BUSINESS_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function resolveRequestedBusinessDate(value: unknown): RequestedBusinessDateResult {
  if (value == null) {
    return { ok: true, businessDate: businessDateVN() };
  }

  if (typeof value !== "string") {
    return { ok: false, message: "Ngày ghi sổ không hợp lệ ạ." };
  }

  const match = ISO_BUSINESS_DATE_RE.exec(value);

  if (!match) {
    return { ok: false, message: "Ngày ghi sổ không hợp lệ ạ." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysByMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const daysInMonth = daysByMonth[month - 1] ?? 0;

  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    return { ok: false, message: "Ngày ghi sổ không hợp lệ ạ." };
  }

  if (value > businessDateVN()) {
    return { ok: false, message: "Ngày ghi sổ không được ở tương lai ạ." };
  }

  return { ok: true, businessDate: value };
}

export async function commitOrder(
  input: CommitOrderInput,
): Promise<ActionResult<CommitOrderView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  // UI already gates on canConfirm; this is a defensive second line. The DB
  // function re-validates and recomputes money in SQL — never trusted from here.
  if (
    !input ||
    typeof input.idempotency_key !== "string" ||
    input.idempotency_key.length === 0 ||
    typeof input.customer_id !== "string" ||
    input.customer_id.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Đơn chưa đủ thông tin để ghi ạ.",
    };
  }

  for (const item of input.items) {
    if (
      typeof item.product_id !== "string" ||
      item.product_id.length === 0 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unit_price) ||
      item.unit_price < 0
    ) {
      return {
        ok: false,
        code: "validation_failed",
        message: "Đơn còn món chưa đủ thông tin ạ.",
      };
    }
  }

  const businessDateResult = resolveRequestedBusinessDate(input.business_date);

  if (!businessDateResult.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: businessDateResult.message,
    };
  }

  const requestedBusinessDate = businessDateResult.businessDate;

  const { data, error } = await supabase.rpc("commit_sale_order", {
    p_idempotency_key: input.idempotency_key,
    p_customer_id: input.customer_id,
    p_business_date: requestedBusinessDate,
    p_note: input.raw_input ?? null,
    p_paid_amount: input.paid_amount ?? 0,
    p_items: input.items.map((item) => ({
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      unit_snapshot: item.unit_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  });

  if (error || !data) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa ghi được đơn, bác thử lại ạ.",
    };
  }

  const result = data as CommitSaleOrderRpcResult;
  let businessDate =
    typeof result.business_date === "string" && result.business_date.length > 0
      ? result.business_date
      : null;

  if (!businessDate) {
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select("business_date")
      .eq("owner_id", user.id)
      .eq("id", result.order_id)
      .is("deleted_at", null)
      .maybeSingle();

    const order = orderData as BusinessDateRow | null;

    if (orderError || !order?.business_date) {
      return {
        ok: false,
        code: "db_error",
        message: "ChÆ°a Ä‘á»c Ä‘Æ°á»£c ngÃ y Ä‘Æ¡n, bÃ¡c thá»­ láº¡i áº¡.",
      };
    }

    businessDate = order.business_date;
  }

  // Telemetry only: event + timestamp + owner, no customer/product/amount.
  // Best-effort — a failed log row must not fail an order that is already written.
  const telemetry = await supabase
    .from("usage_events")
    .insert({ owner_id: user.id, event_type: "order_created" });

  await updateAiInteractionOutcome({
    supabase,
    ownerId: user.id,
    aiTurnId: input.ai_turn_id,
    outcome: "committed",
  });

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
  }

  if (result.idempotent_reuse !== true) {
    const card = await buildHistoryCommitCardSnapshot({
      supabase,
      ownerId: user.id,
      kind: "create_order",
      sourceId: result.order_id,
    });

    await persistAssistantTerminalMessage({
      supabase,
      ownerId: user.id,
      content: commitConfirmationMessage({
        type: "create_order",
        entityName: input.customer_name,
      }),
      intent: "create_order",
      source: "tip_18b",
      metadata: metadataWithHistoryCard({
        order_id: result.order_id,
      }, card),
    });
  }

  return {
    ok: true,
    data: {
      order_id: result.order_id,
      total_amount: Number(result.total_amount),
      debt_amount: Number(result.debt_amount),
      business_date: businessDate,
    },
  };
}

export async function recreateSaleOrder(
  input: RecreateSaleOrderInput,
): Promise<RecreateSaleOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  if (
    !input ||
    typeof input.oldOrderId !== "string" ||
    input.oldOrderId.length === 0 ||
    typeof input.idempotencyKey !== "string" ||
    input.idempotencyKey.length === 0 ||
    typeof input.customer_id !== "string" ||
    input.customer_id.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Đơn chưa đủ thông tin để sửa ạ.",
    };
  }

  for (const item of input.items) {
    if (
      typeof item.product_id !== "string" ||
      item.product_id.length === 0 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unit_price) ||
      item.unit_price < 0
    ) {
      return {
        ok: false,
        code: "validation_failed",
        message: "Đơn còn món chưa đủ thông tin ạ.",
      };
    }
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("business_date,status")
    .eq("owner_id", user.id)
    .eq("id", input.oldOrderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa đọc được đơn cũ, bác thử lại ạ.",
    };
  }

  if (!orderData) {
    return {
      ok: false,
      code: "not_found",
      message: "Không tìm thấy đơn cũ để sửa ạ.",
    };
  }

  const originalOrder = orderData as OriginalOrderRow;

  if (originalOrder.status !== "confirmed") {
    return {
      ok: false,
      code: "not_editable",
      message: "Đơn này không sửa được nữa ạ.",
    };
  }

  const { data: undoData, error: undoError } = await supabase.rpc("undo_order", {
    p_order_id: input.oldOrderId,
  });

  if (undoError || !undoData) {
    return {
      ok: false,
      code: "db_error",
      message: "Chưa huỷ được đơn cũ, bác thử lại ạ.",
    };
  }

  const undoResult = undoData as UndoRpcResult;

  if (undoResult.already_undone === true) {
    return {
      ok: false,
      code: "already_undone",
      message: "Đơn này đã bị huỷ rồi ạ.",
    };
  }

  const { data: commitData, error: commitError } = await supabase.rpc(
    "commit_sale_order",
    {
      p_idempotency_key: input.idempotencyKey,
      p_customer_id: input.customer_id,
      p_business_date: originalOrder.business_date,
      p_note: input.raw_input ?? null,
      p_items: input.items.map((item) => ({
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        unit_snapshot: item.unit_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    },
  );

  if (commitError || !commitData) {
    return {
      ok: false,
      code: "recommit_failed",
      message: "Đơn cũ đã huỷ, ghi lại không thành công. Bác tạo lại đơn giúp em ạ.",
      oldVoided: true,
    };
  }

  const result = commitData as CommitSaleOrderRpcResult;

  if (result.idempotent_reuse !== true) {
    const card = await buildHistoryCommitCardSnapshot({
      supabase,
      ownerId: user.id,
      kind: "edit_order",
      sourceId: result.order_id,
    });

    await persistAssistantTerminalMessage({
      supabase,
      ownerId: user.id,
      content: commitConfirmationMessage({ type: "edit_order" }),
      intent: "edit_order",
      source: "tip_18b",
      metadata: metadataWithHistoryCard({
        old_order_id: input.oldOrderId,
        new_order_id: result.order_id,
      }, card),
    });
  }

  return {
    ok: true,
    data: {
      newOrderId: result.order_id,
      total_amount: Number(result.total_amount),
      debt_amount: Number(result.debt_amount),
      business_date: originalOrder.business_date,
    },
  };
}

export type CommitPaymentInput = Readonly<{
  idempotency_key: string;
  customer_id: string;
  customer_name?: string | null;
  amount: number;
  raw_input: string;
  business_date?: string | null;
  ai_turn_id?: string;
}>;

export type CommitPaymentView = {
  payment_id: string;
  amount: number;
  new_debt_total: number;
  business_date: string | null;
};

type CommitPaymentRpcResult = {
  payment_id: string;
  amount: number | string;
  new_debt_total: number | string;
  business_date?: string;
  idempotent_reuse?: boolean;
};

export async function commitPayment(
  input: CommitPaymentInput,
): Promise<ActionResult<CommitPaymentView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "unauthorized", message: "Vui lòng đăng nhập lại ạ." };
  }

  if (
    !input ||
    typeof input.idempotency_key !== "string" ||
    input.idempotency_key.length === 0 ||
    typeof input.customer_id !== "string" ||
    input.customer_id.length === 0 ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return { ok: false, code: "validation_failed", message: "Số tiền chưa hợp lệ ạ." };
  }

  const businessDateResult = resolveRequestedBusinessDate(input.business_date);

  if (!businessDateResult.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: businessDateResult.message,
    };
  }

  const { data, error } = await supabase.rpc("commit_payment", {
    p_idempotency_key: input.idempotency_key,
    p_customer_id: input.customer_id,
    p_amount: input.amount,
    p_method: null,
    p_note: input.raw_input ?? null,
    p_business_date: businessDateResult.businessDate,
  });

  if (error || !data) {
    // Plan B overpayment guard surfaces as a check violation mentioning "exceeds".
    if (error?.message?.includes("exceeds")) {
      return {
        ok: false,
        code: "validation_failed",
        message: "Số tiền trả lớn hơn số nợ hiện tại ạ.",
      };
    }
    return { ok: false, code: "db_error", message: "Chưa ghi được, bác thử lại ạ." };
  }

  const result = data as CommitPaymentRpcResult;

  const telemetry = await supabase
    .from("usage_events")
    .insert({ owner_id: user.id, event_type: "payment_created" });

  await updateAiInteractionOutcome({
    supabase,
    ownerId: user.id,
    aiTurnId: input.ai_turn_id,
    outcome: "committed",
  });

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
  }

  if (result.idempotent_reuse !== true) {
    const card = await buildHistoryCommitCardSnapshot({
      supabase,
      ownerId: user.id,
      kind: "record_payment",
      sourceId: result.payment_id,
    });

    await persistAssistantTerminalMessage({
      supabase,
      ownerId: user.id,
      content: commitConfirmationMessage({
        type: "record_payment",
        entityName: input.customer_name,
      }),
      intent: "record_payment",
      source: "tip_18b",
      metadata: metadataWithHistoryCard({
        payment_id: result.payment_id,
      }, card),
    });
  }

  return {
    ok: true,
    data: {
      payment_id: result.payment_id,
      amount: Number(result.amount),
      new_debt_total: Number(result.new_debt_total),
      business_date:
        typeof result.business_date === "string" &&
        result.business_date.length > 0
          ? result.business_date
          : businessDateResult.businessDate,
    },
  };
}

export type CommitPurchaseItemInput = Readonly<{
  product_id: string;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  quantity: number;
  unit_cost: number;
}>;

export type CommitPurchaseInput = Readonly<{
  idempotency_key: string;
  supplier_id: string | null;
  supplier_name?: string | null;
  raw_input: string;
  business_date?: string | null;
  ai_turn_id?: string;
  items: CommitPurchaseItemInput[];
}>;

export type CommitPurchaseView = {
  purchase_id: string;
  total_amount: number;
  business_date: string;
};

type CommitPurchaseRpcResult = {
  purchase_id: string;
  total_amount: number | string;
  business_date?: string;
  idempotent_reuse?: boolean;
};

export async function commitPurchase(
  input: CommitPurchaseInput,
): Promise<ActionResult<CommitPurchaseView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "unauthorized", message: "Vui lòng đăng nhập lại ạ." };
  }

  if (
    !input ||
    typeof input.idempotency_key !== "string" ||
    input.idempotency_key.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length === 0
  ) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Đơn nhập chưa đủ thông tin để ghi ạ.",
    };
  }

  for (const item of input.items) {
    if (
      typeof item.product_id !== "string" ||
      item.product_id.length === 0 ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isFinite(item.unit_cost) ||
      item.unit_cost < 0
    ) {
      return {
        ok: false,
        code: "validation_failed",
        message: "Đơn nhập còn món chưa đủ thông tin ạ.",
      };
    }
  }

  const businessDateResult = resolveRequestedBusinessDate(input.business_date);

  if (!businessDateResult.ok) {
    return {
      ok: false,
      code: "validation_failed",
      message: businessDateResult.message,
    };
  }

  const requestedBusinessDate = businessDateResult.businessDate;

  const { data, error } = await supabase.rpc("commit_purchase", {
    p_idempotency_key: input.idempotency_key,
    p_supplier_id: input.supplier_id,
    p_business_date: requestedBusinessDate,
    p_note: input.raw_input ?? null,
    p_items: input.items.map((item) => ({
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      unit_snapshot: item.unit_snapshot,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    })),
  });

  if (error || !data) {
    return { ok: false, code: "db_error", message: "Chưa ghi được đơn nhập, bác thử lại ạ." };
  }

  const result = data as CommitPurchaseRpcResult;
  let businessDate =
    typeof result.business_date === "string" && result.business_date.length > 0
      ? result.business_date
      : null;

  if (!businessDate) {
    const { data: purchaseData, error: purchaseError } = await supabase
      .from("purchases")
      .select("business_date")
      .eq("owner_id", user.id)
      .eq("id", result.purchase_id)
      .is("deleted_at", null)
      .maybeSingle();

    const purchase = purchaseData as BusinessDateRow | null;

    if (purchaseError || !purchase?.business_date) {
      return {
        ok: false,
        code: "db_error",
        message: "ChÆ°a Ä‘á»c Ä‘Æ°á»£c ngÃ y Ä‘Æ¡n nháº­p, bÃ¡c thá»­ láº¡i áº¡.",
      };
    }

    businessDate = purchase.business_date;
  }

  const telemetry = await supabase
    .from("usage_events")
    .insert({ owner_id: user.id, event_type: "purchase_created" });

  await updateAiInteractionOutcome({
    supabase,
    ownerId: user.id,
    aiTurnId: input.ai_turn_id,
    outcome: "committed",
  });

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
  }

  if (result.idempotent_reuse !== true) {
    const card = await buildHistoryCommitCardSnapshot({
      supabase,
      ownerId: user.id,
      kind: "create_purchase",
      sourceId: result.purchase_id,
    });

    await persistAssistantTerminalMessage({
      supabase,
      ownerId: user.id,
      content: commitConfirmationMessage({
        type: "create_purchase",
        supplierName: input.supplier_name,
      }),
      intent: "create_purchase",
      source: "tip_18b",
      metadata: metadataWithHistoryCard({
        purchase_id: result.purchase_id,
      }, card),
    });
  }

  return {
    ok: true,
    data: {
      purchase_id: result.purchase_id,
      total_amount: Number(result.total_amount),
      business_date: businessDate,
    },
  };
}

export type CustomerDebtView = { debt_total: number };

// Read-only: current debt for the payment card's live overpayment check.
export async function getCustomerDebt(
  customerId: string,
): Promise<ActionResult<CustomerDebtView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "unauthorized", message: "Vui lòng đăng nhập lại ạ." };
  }

  if (typeof customerId !== "string" || customerId.length === 0) {
    return { ok: false, code: "validation_failed", message: "Thiếu mã khách ạ." };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("debt_total")
    .eq("owner_id", user.id)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, code: "db_error", message: "Chưa đọc được công nợ ạ." };
  }

  return {
    ok: true,
    data: { debt_total: Number((data as { debt_total: number | string }).debt_total) },
  };
}

export type UndoTarget = "order" | "payment" | "purchase";

export type UndoView = {
  kind: UndoTarget;
  already_undone: boolean;
  new_debt_total: number | null;
};

type UndoRpcResult = {
  already_undone?: boolean;
  new_debt_total?: number | string | null;
};

// Undo the just-committed order/payment/purchase via its compensating function.
// Idempotent at the DB layer, so re-clicking after a flaky response is safe.
export async function undoCommit(
  target: UndoTarget,
  id: string,
  aiTurnId?: string,
): Promise<ActionResult<UndoView>> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, code: "unauthorized", message: "Vui lòng đăng nhập lại ạ." };
  }

  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, code: "validation_failed", message: "Thiếu mã đơn để huỷ ạ." };
  }

  const call =
    target === "order"
      ? supabase.rpc("undo_order", { p_order_id: id })
      : target === "payment"
        ? supabase.rpc("undo_payment", { p_payment_id: id })
        : supabase.rpc("undo_purchase", { p_purchase_id: id });

  const { data, error } = await call;

  if (error || !data) {
    return { ok: false, code: "db_error", message: "Chưa huỷ được, bác thử lại ạ." };
  }

  const result = data as UndoRpcResult;

  const telemetry = await supabase
    .from("usage_events")
    .insert({ owner_id: user.id, event_type: "undo" });

  await updateAiInteractionOutcome({
    supabase,
    ownerId: user.id,
    aiTurnId,
    outcome: "undone",
  });

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
  }

  return {
    ok: true,
    data: {
      kind: target,
      already_undone: result.already_undone === true,
      new_debt_total:
        result.new_debt_total === null || result.new_debt_total === undefined
          ? null
          : Number(result.new_debt_total),
    },
  };
}

export async function processMessage(
  content: string,
): Promise<ProcessMessageResult> {
  const saved = await sendMessage(content);

  if (!saved.ok) {
    return saved;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "Vui lòng đăng nhập lại ạ.",
    };
  }

  const guardDecision = await checkAiGuard({ supabase, ownerId: user.id });
  if (!guardDecision.allow) {
    await persistAssistantTerminalMessage({
      supabase,
      ownerId: user.id,
      content: guardDecision.message,
      intent: guardDecision.reason,
      source: "tip_d8b_cost_guard",
    });

    return {
      ok: true,
      userMessage: saved.data,
      pipeline: {
        ok: false,
        stage: "extract",
        code: guardDecision.reason,
        message: guardDecision.message,
      },
      terminalText: guardDecision.message,
    };
  }

  const t0 = Date.now();
  const pipeline = await runChatPipeline({
    rawText: saved.data.content,
    ownerId: user.id,
    supabase,
  });
  const latencyMs = Date.now() - t0;
  const turnId = await logAiInteraction({
    supabase,
    ownerId: user.id,
    rawText: saved.data.content,
    pipeline,
    latencyMs,
  });

  const answer =
    pipeline.ok &&
    pipeline.validated.kind === "query" &&
    (pipeline.validated.intent === "query_debt" ||
      pipeline.validated.intent === "query_sales" ||
      pipeline.validated.intent === "query_inventory")
      ? await answerQuery({
          extracted: pipeline.extracted,
          validated: pipeline.validated,
          ownerId: user.id,
          supabase,
        })
      : null;
  const productManagementPreviewResult = pipeline.ok
    ? await resolveProductManagementPreview({
        productManagement: pipeline.extracted.entities.product_management,
        ownerId: user.id,
        supabase,
      })
    : { ok: true as const, data: null };
  const customerManagementPreviewResult = pipeline.ok
    ? await resolveCustomerManagementPreview({
        customerManagement: pipeline.extracted.entities.customer_management,
        ownerId: user.id,
        supabase,
      })
    : { ok: true as const, data: null };

  if (!productManagementPreviewResult.ok) {
    return productManagementPreviewResult;
  }

  if (!customerManagementPreviewResult.ok) {
    return customerManagementPreviewResult;
  }

  await persistTerminalProductManagementPreview({
    supabase,
    ownerId: user.id,
    preview: productManagementPreviewResult.data,
  });
  await persistTerminalCustomerManagementPreview({
    supabase,
    ownerId: user.id,
    preview: customerManagementPreviewResult.data,
  });

  const terminalText = await persistTerminalAssistantResponse({
    supabase,
    ownerId: user.id,
    pipeline,
    answer,
  });

  return {
    ok: true,
    userMessage: saved.data,
    pipeline,
    ...(answer ? { answer } : {}),
    ...(customerManagementPreviewResult.data
      ? { customerManagementPreview: customerManagementPreviewResult.data }
      : {}),
    ...(productManagementPreviewResult.data
      ? { productManagementPreview: productManagementPreviewResult.data }
      : {}),
    ...(terminalText ? { terminalText } : {}),
    ...(turnId ? { turnId } : {}),
  };
}
