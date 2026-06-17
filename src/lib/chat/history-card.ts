import { z } from "zod";
import { formatVietnameseMoney } from "@/src/lib/format/money";

const HistoryCommitCardItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unit: z.string(),
  unit_price: z.number().nullable(),
  line_total: z.number().nullable(),
});

const HistoryCommitCardSchema = z.object({
  v: z.literal(1),
  kind: z.enum(["create_order", "record_payment", "create_purchase", "edit_order"]),
  entity_name: z.string().nullable(),
  business_date: z.string().nullable(),
  total_amount: z.number().nullable(),
  debt_amount: z.number().nullable(),
  amount: z.number().nullable(),
  items: z.array(HistoryCommitCardItemSchema).nullable(),
  source_id: z.string().min(1).nullable(),
});

export const HistoryProductCardSchema = z.object({
  v: z.literal(1),
  kind: z.literal("manage_product"),
  action: z.enum(["create", "set_unit", "set_price", "delete"]),
  status: z.enum([
    "created",
    "create_duplicate",
    "saved",
    "not_found",
    "deleted",
    "dismissed",
  ]),
  product_name: z.string().nullable(),
  product_raw: z.string().nullable(),
  unit: z.string().nullable(),
  sell_price: z.number().nullable(),
});

export const HistoryCustomerCardSchema = z.object({
  v: z.literal(1),
  kind: z.literal("manage_customer"),
  action: z.literal("rename"),
  status: z.enum(["renamed", "dismissed", "not_found"]),
  customer_name: z.string().nullable(),
  customer_raw: z.string().nullable(),
  new_name: z.string().nullable(),
});

export type HistoryCommitCard = z.infer<typeof HistoryCommitCardSchema>;
export type HistoryCommitCardItem = z.infer<typeof HistoryCommitCardItemSchema>;
export type HistoryProductCard = z.infer<typeof HistoryProductCardSchema>;
export type HistoryCustomerCard = z.infer<typeof HistoryCustomerCardSchema>;

export function parseHistoryCommitCard(metadata: unknown): HistoryCommitCard | null {
  if (!metadata || typeof metadata !== "object" || !("card" in metadata)) {
    return null;
  }

  const parsed = HistoryCommitCardSchema.safeParse(
    (metadata as { card?: unknown }).card,
  );

  return parsed.success ? parsed.data : null;
}

export function parseHistoryProductCard(
  metadata: unknown,
): HistoryProductCard | null {
  if (!metadata || typeof metadata !== "object" || !("card" in metadata)) {
    return null;
  }

  const parsed = HistoryProductCardSchema.safeParse(
    (metadata as { card?: unknown }).card,
  );

  return parsed.success ? parsed.data : null;
}

export function parseHistoryCustomerCard(
  metadata: unknown,
): HistoryCustomerCard | null {
  if (!metadata || typeof metadata !== "object" || !("card" in metadata)) {
    return null;
  }

  const parsed = HistoryCustomerCardSchema.safeParse(
    (metadata as { card?: unknown }).card,
  );

  return parsed.success ? parsed.data : null;
}

export function historyCustomerCardContent(card: HistoryCustomerCard) {
  const currentName =
    card.customer_name?.trim() || card.customer_raw?.trim() || "này";
  const newName = card.new_name?.trim() || "—";

  if (card.status === "renamed") {
    return `Đã đổi tên khách ${currentName} thành ${newName}.`;
  }

  if (card.status === "not_found") {
    return `Không tìm thấy khách tên ${currentName} ạ.`;
  }

  return "Đã bỏ, chưa đổi tên khách.";
}

export function historyProductCardContent(card: HistoryProductCard) {
  const name = card.product_name?.trim() || card.product_raw?.trim() || "này";

  if (card.status === "created") {
    const details = [
      card.unit,
      card.sell_price === null
        ? null
        : formatVietnameseMoney(card.sell_price),
    ].filter((value): value is string => Boolean(value));

    return `Đã thêm hàng ${name}${details.length > 0 ? ` (${details.join(", ")})` : ""}.`;
  }

  if (card.status === "create_duplicate") {
    return `Hàng '${name}' đã có trong danh sách.`;
  }

  if (card.status === "saved") {
    if (card.action === "set_unit") {
      return `Đã đổi đơn vị hàng ${name} thành ${card.unit ?? "—"}.`;
    }

    return `Đã đặt giá bán hàng ${name} thành ${
      card.sell_price === null
        ? "—"
        : formatVietnameseMoney(card.sell_price)
    }.`;
  }

  if (card.status === "not_found") {
    return `Em chưa thấy hàng '${name}' trong danh sách ạ.`;
  }

  if (card.status === "deleted") {
    return `Đã xóa hàng ${name} khỏi danh sách.`;
  }

  return "Đã bỏ, chưa lưu vào danh sách.";
}
