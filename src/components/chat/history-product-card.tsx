"use client";

import { Check } from "lucide-react";
import type { HistoryProductCard as HistoryProductCardData } from "@/src/lib/chat/history-card";
import { formatVietnameseMoney } from "@/src/lib/format/money";

type HistoryProductCardProps = Readonly<{
  card: HistoryProductCardData;
  confirmationText: string;
}>;

const STATUS_TITLE: Record<HistoryProductCardData["status"], string> = {
  created: "Đã thêm hàng",
  create_duplicate: "Hàng đã có",
  saved: "Đã lưu thay đổi",
  not_found: "Không tìm thấy hàng",
  deleted: "Đã xóa hàng",
  dismissed: "Đã bỏ",
};

function productName(card: HistoryProductCardData) {
  return card.product_name?.trim() || card.product_raw?.trim() || "—";
}

function formatPrice(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : formatVietnameseMoney(value);
}

function confirmationTone(card: HistoryProductCardData) {
  return card.status === "dismissed" || card.status === "not_found"
    ? "text-textMute"
    : "text-paid";
}

function showsCheck(card: HistoryProductCardData) {
  return (
    card.status === "created" ||
    card.status === "saved" ||
    card.status === "deleted"
  );
}

export function HistoryProductCard({
  card,
  confirmationText,
}: HistoryProductCardProps) {
  return (
    <div className="flex w-full justify-start">
      <article
        className="w-full max-w-[94%] rounded border border-ledgerBorder bg-paperWarm px-4 py-4 text-textMain shadow-none sm:max-w-[88%]"
        data-testid="history-product-card"
      >
        <div className="border-b border-ledgerBorder pb-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            manage_product
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
            {STATUS_TITLE[card.status]}
          </h2>
        </div>

        <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
          <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
            <p className="font-semibold text-textMute">Hàng</p>
            <p className="font-semibold text-inkDeep">{productName(card)}</p>
            {card.unit !== null ? (
              <>
                <p className="font-semibold text-textMute">Đơn vị</p>
                <p className="font-semibold">{card.unit}</p>
              </>
            ) : null}
            {card.sell_price !== null ? (
              <>
                <p className="font-semibold text-textMute">Giá bán</p>
                <p className="font-semibold">{formatPrice(card.sell_price)}</p>
              </>
            ) : null}
          </div>
        </div>

        <p
          className={`mt-4 flex items-center gap-2 border-t border-ledgerBorder pt-3 text-[16px] font-semibold leading-6 ${confirmationTone(card)}`}
        >
          {showsCheck(card) ? (
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : null}
          {confirmationText}
        </p>
      </article>
    </div>
  );
}
