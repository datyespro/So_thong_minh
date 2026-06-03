"use server";

import type { ActionResult } from "@/src/types/action-result";
import type { ChatMessageView } from "@/src/components/chat/types";
import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import {
  runChatPipeline,
  type ChatPipelineResult,
} from "@/src/lib/ai/chat-pipeline";
import {
  answerQuery,
  type QueryAnswer,
} from "@/src/lib/ai/answer-query";
import { resolveOne, type EntityRow } from "@/src/lib/ai/entity-resolver";
import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import {
  parseProductSellPriceInput,
  validateProductUpdatePatch,
  type ProductSellPriceInput,
  type ProductUpdateInput,
} from "@/src/lib/products/update";
import { createClient } from "@/src/lib/supabase/server";
import { businessDateVN } from "@/src/lib/dayjs";

const MAX_MESSAGE_LENGTH = 2000;

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
  aliases: string[] | null;
};

type ProductUpdateRow = {
  id: string;
  unit: string;
  sell_price: number | string | null;
};

export type CreatedCustomerView = CustomerRow;
export type CreatedProductView = {
  id: string;
  name: string;
  unit: string;
  sell_price: number | null;
};
export type UpdatedProductView = {
  id: string;
  unit: string;
  sell_price: number | null;
};

export type ProcessMessageResult =
  | {
      ok: true;
      userMessage: ChatMessageView;
      pipeline: ChatPipelineResult;
      answer?: QueryAnswer | null;
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

function normalizeCustomerName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

function findCustomerByName(rows: CustomerRow[] | null, name: string) {
  const normalized = normalizeCustomerName(name);

  return (rows ?? []).find(
    (row) => normalizeCustomerName(row.name) === normalized,
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

function normalizeProductSearchRows(rows: ProductSearchRow[] | null): EntityRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    unit:
      typeof row.unit === "string" && row.unit.trim().length > 0
        ? row.unit
        : null,
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
  }));
}

function nullableProductMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? Math.round(numeric) : null;
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

  if (normalizedUnit !== undefined && normalizedUnit.length === 0) {
    return {
      ok: false,
      code: "validation_failed",
      message: "Đơn vị không được để trống",
    };
  }

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

  return {
    ok: true,
    data: createdProductView(data as ProductRow),
  };
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
    .select("id,name,aliases,unit")
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
    .select("id,unit,sell_price")
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
  const { data, error } = await supabase
    .from("products")
    .update(validation.data.patch)
    .eq("owner_id", user.id)
    .eq("id", trimmedProductId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .select("id,unit,sell_price")
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
    unit: before.unit,
    sell_price: nullableProductMoney(before.sell_price),
  };
  const afterAudit = {
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
      unit: updated.unit,
      sell_price: nullableProductMoney(updated.sell_price),
    },
  };
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
  raw_input: string;
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

  const requestedBusinessDate = businessDateVN();

  const { data, error } = await supabase.rpc("commit_sale_order", {
    p_idempotency_key: input.idempotency_key,
    p_customer_id: input.customer_id,
    p_business_date: requestedBusinessDate,
    p_note: input.raw_input ?? null,
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

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
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
  amount: number;
  raw_input: string;
}>;

export type CommitPaymentView = {
  payment_id: string;
  amount: number;
  new_debt_total: number;
};

type CommitPaymentRpcResult = {
  payment_id: string;
  amount: number | string;
  new_debt_total: number | string;
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

  const { data, error } = await supabase.rpc("commit_payment", {
    p_idempotency_key: input.idempotency_key,
    p_customer_id: input.customer_id,
    p_amount: input.amount,
    p_method: null,
    p_note: input.raw_input ?? null,
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

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
  }

  return {
    ok: true,
    data: {
      payment_id: result.payment_id,
      amount: Number(result.amount),
      new_debt_total: Number(result.new_debt_total),
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
  raw_input: string;
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

  const requestedBusinessDate = businessDateVN();

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

  if (telemetry.error) {
    console.error("usage_events insert failed", telemetry.error);
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

  const pipeline = await runChatPipeline({
    rawText: saved.data.content,
    ownerId: user.id,
    supabase,
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

  return {
    ok: true,
    userMessage: saved.data,
    pipeline,
    ...(answer ? { answer } : {}),
  };
}
