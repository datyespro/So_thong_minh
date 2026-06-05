import type { QueryAnswer } from "@/src/lib/ai/answer-query";
import { formatVietnameseMoney } from "@/src/lib/format/money";

export type CommitConfirmationMessageInput =
  | { type: "create_order"; entityName?: string | null }
  | { type: "record_payment"; entityName?: string | null }
  | { type: "create_purchase"; supplierName?: string | null }
  | { type: "edit_order" };

export function friendlyNoneMessage(intent: string) {
  if (intent === "manage_product") {
    // TEMPORARY TIP-#3-D-a: recognition only. Real product actions land in
    // #3-D-b/#3-E; do not write product data from this branch.
    return "Dạ, em đã hiểu ý bác. Tính năng quản lý hàng qua chat em đang hoàn thiện ạ.";
  }

  return intent === "small_talk" ? "Dạ, em nghe ạ." : "Em chưa rõ ý câu này ạ.";
}

function displayNameOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function commitConfirmationMessage(
  input: CommitConfirmationMessageInput,
): string {
  if (input.type === "create_order") {
    return `Đã ghi đơn cho ${displayNameOrFallback(input.entityName, "khách")}`;
  }

  if (input.type === "record_payment") {
    return `Đã ghi thu nợ cho ${displayNameOrFallback(input.entityName, "khách")}`;
  }

  if (input.type === "create_purchase") {
    const supplierName = input.supplierName?.trim();
    return supplierName && supplierName.length > 0
      ? `Đã ghi nhập hàng từ ${supplierName}`
      : "Đã ghi nhập hàng";
  }

  return "Đã sửa đơn";
}

function formatInventoryStock(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function queryAnswerToText(answer: QueryAnswer): string {
  if (answer.state === "read_error") {
    return answer.message;
  }

  if (answer.type === "debt") {
    if (answer.state === "found") {
      if (answer.debt <= 0) {
        return `${answer.customerName} không còn nợ ạ.`;
      }

      return `${answer.customerName} đang nợ ${formatVietnameseMoney(answer.debt)}`;
    }

    if (answer.state === "ambiguous") {
      const names =
        answer.candidates.length > 0
          ? answer.candidates.join(", ")
          : "các tên gần giống trong sổ";

      return `Em chưa chắc bác hỏi ai: ${names}. Bác nhắn rõ tên giúp em ạ.`;
    }

    return `Em chưa thấy khách tên "${answer.askedName}" trong sổ ạ.`;
  }

  if (answer.type === "inventory") {
    if (answer.state === "found") {
      if (answer.stock === 0) {
        return `${answer.productName} hết hàng rồi ạ.`;
      }

      if (answer.stock < 0) {
        return `${answer.productName} đang âm ${formatInventoryStock(Math.abs(answer.stock))} ${answer.unit} (đã bán quá tồn) ạ.`;
      }

      return `Còn ${formatInventoryStock(answer.stock)} ${answer.unit} ${answer.productName}`;
    }

    if (answer.state === "ambiguous") {
      const names =
        answer.candidates.length > 0
          ? answer.candidates.join(", ")
          : "các hàng gần giống trong sổ";

      return `Em chưa chắc bác hỏi hàng nào: ${names}. Bác nói rõ tên giúp em ạ.`;
    }

    return `Em chưa thấy hàng "${answer.askedName}" trong sổ ạ.`;
  }

  if (answer.state === "unsupported_range") {
    return "Khúc thời gian này em chưa tra được, bác hỏi giúp em theo hôm nay / hôm qua / tuần này / tháng này nhé.";
  }

  if (answer.orders <= 0) {
    return `${answer.rangeLabel} chưa bán đơn nào ạ.`;
  }

  return `${answer.rangeLabel}: ${answer.orders} đơn, doanh thu ${formatVietnameseMoney(answer.revenue)}. Đã thu ${formatVietnameseMoney(answer.paid)}, nợ thêm ${formatVietnameseMoney(answer.debt)}`;
}
