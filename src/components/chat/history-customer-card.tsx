"use client";

import { Check } from "lucide-react";
import type { HistoryCustomerCard as HistoryCustomerCardData } from "@/src/lib/chat/history-card";

type HistoryCustomerCardProps = Readonly<{
  card: HistoryCustomerCardData;
  confirmationText: string;
}>;

const STATUS_TITLE: Record<HistoryCustomerCardData["status"], string> = {
  renamed: "Đã đổi tên khách",
  phone_set: "Đã cập nhật SĐT",
  not_found: "Không tìm thấy khách",
  dismissed: "Đã bỏ",
};

function customerName(card: HistoryCustomerCardData) {
  return card.customer_name?.trim() || card.customer_raw?.trim() || "—";
}

function confirmationTone(card: HistoryCustomerCardData) {
  return card.status === "renamed" || card.status === "phone_set"
    ? "text-paid"
    : "text-textMute";
}

export function HistoryCustomerCard({
  card,
  confirmationText,
}: HistoryCustomerCardProps) {
  return (
    <div className="flex w-full justify-start">
      <article
        className="w-full max-w-[94%] rounded border border-ledgerBorder bg-paperWarm px-4 py-4 text-textMain shadow-none sm:max-w-[88%]"
        data-testid="history-customer-card"
      >
        <div className="border-b border-ledgerBorder pb-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            manage_customer
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
            {STATUS_TITLE[card.status]}
          </h2>
        </div>

        <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
          <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
            <p className="font-semibold text-textMute">Khách</p>
            <p className="font-semibold text-inkDeep">{customerName(card)}</p>
            {card.new_name !== null ? (
              <>
                <p className="font-semibold text-textMute">Tên mới</p>
                <p className="font-semibold text-paid">{card.new_name}</p>
              </>
            ) : null}
            {card.phone_raw !== null ? (
              <>
                <p className="font-semibold text-textMute">SĐT</p>
                <p className="font-semibold text-paid">{card.phone_raw}</p>
              </>
            ) : null}
          </div>
        </div>

        <p
          className={`mt-4 flex items-center gap-2 border-t border-ledgerBorder pt-3 text-[16px] font-semibold leading-6 ${confirmationTone(card)}`}
        >
          {card.status === "renamed" || card.status === "phone_set" ? (
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : null}
          {confirmationText}
        </p>
      </article>
    </div>
  );
}
