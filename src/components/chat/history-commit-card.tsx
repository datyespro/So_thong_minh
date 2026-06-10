"use client";

import { Check } from "lucide-react";
import type { HistoryCommitCard } from "@/src/lib/chat/history-card";
import { dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";

type HistoryCommitCardProps = Readonly<{
  card: HistoryCommitCard;
  confirmationText: string;
  confirmationTone?: "committed" | "dismissed";
}>;

const CARD_TITLE: Record<HistoryCommitCard["kind"], string> = {
  create_order: "Đơn bán hàng",
  record_payment: "Thu / trả nợ",
  create_purchase: "Đơn nhập hàng",
  edit_order: "Đã sửa đơn",
};

function counterpartyLabel(kind: HistoryCommitCard["kind"]) {
  return kind === "create_purchase" ? "Nhà cung cấp" : "Khách";
}

function counterpartyName(card: HistoryCommitCard) {
  const name = card.entity_name?.trim();

  if (name) {
    return name;
  }

  return card.kind === "create_purchase" ? "Chưa có NCC" : "Khách lẻ";
}

function moneyTotal(card: HistoryCommitCard) {
  return card.kind === "record_payment" ? card.amount : card.total_amount;
}

function moneyLabel(card: HistoryCommitCard) {
  return card.kind === "record_payment" ? "Số tiền" : "Tổng tiền";
}

function formatHistoryMoney(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "—"
    : formatVietnameseMoney(value);
}

function formatBusinessDate(value: string) {
  return dayjs(value).format("DD/MM/YYYY");
}

export function HistoryCommitCard({
  card,
  confirmationText,
  confirmationTone = "committed",
}: HistoryCommitCardProps) {
  const items = card.items ?? [];

  return (
    <div className="flex w-full justify-start">
      <article
        className="w-full max-w-[94%] rounded border border-ledgerBorder bg-surface px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]"
        data-testid="history-commit-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ledgerBorder pb-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
              {card.kind}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
              {CARD_TITLE[card.kind]}
            </h2>
            {card.business_date ? (
              <p className="mt-1 text-[14px] leading-5 text-textMute">
                Ngày: {formatBusinessDate(card.business_date)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[14px] leading-5 text-textMute">{moneyLabel(card)}</p>
            <p className="font-display text-2xl font-semibold tracking-normal text-paid">
              {formatHistoryMoney(moneyTotal(card))}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
          <p className="font-semibold text-textMute">
            {counterpartyLabel(card.kind)}
          </p>
          <p className="font-semibold text-inkDeep">{counterpartyName(card)}</p>
        </div>

        {card.kind === "record_payment" ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Số tiền</p>
              <p className="font-semibold text-inkDeep">
                {formatHistoryMoney(card.amount)}
              </p>
            </div>
          </div>
        ) : items.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded border border-ledgerBorder">
            <div className="hidden gap-2 bg-paperWarm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp sm:grid sm:grid-cols-[1.5fr_0.75fr_0.55fr_1fr_1fr]">
              <span>Mặt hàng</span>
              <span>Số lượng</span>
              <span>Đơn vị</span>
              <span>Đơn giá</span>
              <span>Thành tiền</span>
            </div>
            <div className="divide-y divide-ledgerBorder">
              {items.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="block px-3 py-3 text-[16px] leading-7 sm:grid sm:grid-cols-[1.5fr_0.75fr_0.55fr_1fr_1fr] sm:gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-inkDeep">{item.name}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                      Số lượng
                    </p>
                    <p className="font-semibold">{item.quantity ?? "—"}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                      Đơn vị
                    </p>
                    <p className="font-semibold text-textMute">{item.unit}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                      Đơn giá
                    </p>
                    <p className="font-semibold">
                      {formatHistoryMoney(item.unit_price)}
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                      Thành tiền
                    </p>
                    <p className="font-semibold text-inkDeep">
                      {formatHistoryMoney(item.line_total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 border-t border-ledgerBorder pt-3">
          <p
            className={`flex items-center gap-2 text-[16px] font-semibold leading-6 ${
              confirmationTone === "dismissed" ? "text-textMute" : "text-paid"
            }`}
          >
            {confirmationTone === "committed" ? (
              <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : null}
            {confirmationText}
          </p>
        </div>
      </article>
    </div>
  );
}
