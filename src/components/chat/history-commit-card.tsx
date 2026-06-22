"use client";

import * as React from "react";
import { Check } from "lucide-react";
import type { HistoryCommitCard } from "@/src/lib/chat/history-card";
import { dayjs } from "@/src/lib/dayjs";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { Button } from "@/src/components/ui/button";
import { PaymentUndoModal } from "@/src/components/chat/payment-undo-modal";
import { PaymentScopeModal } from "@/src/components/chat/payment-scope-modal";

type HistoryCommitCardProps = Readonly<{
  card: HistoryCommitCard;
  confirmationText: string;
  confirmationTone?: "committed" | "dismissed";
  messageId?: string;
  undone?: boolean;
  onUndone?: () => void;
  onScopeChanged?: () => void;
}>;

const CARD_TITLE: Record<HistoryCommitCard["kind"], string> = {
  create_order: "Đơn bán hàng",
  record_payment: "Thu / trả nợ / đặt cọc",
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
  messageId,
  undone = false,
  onUndone,
  onScopeChanged,
}: HistoryCommitCardProps) {
  const items = card.items ?? [];
  const [undoModalOpen, setUndoModalOpen] = React.useState(false);
  const [scopeModalOpen, setScopeModalOpen] = React.useState(false);
  // DC-4b: nhãn nhóm vừa đổi (hiện ngay trước reload). null hợp lệ (bỏ nhóm) nên
  // dùng bọc {label} để phân biệt "chưa đổi" (null) vs "đã đổi về Chung" ({label:null}).
  const [scopeOverride, setScopeOverride] = React.useState<{
    label: string | null;
  } | null>(null);

  // UNDO-HIST: khi đã hoàn tác, trạng thái "Đã hoàn tác" THẮNG cả confirmationText
  // (bỏ qua "Đã ghi thu nợ…" gốc) lẫn confirmationTone (xám, không tick, không nút).
  const effectiveTone = undone ? "dismissed" : confirmationTone;
  const effectiveText = undone ? "Đã hoàn tác" : confirmationText;
  const effectiveScopeLabel = scopeOverride ? scopeOverride.label : card.scope_label;
  const canUndoPayment =
    card.kind === "record_payment" &&
    confirmationTone === "committed" &&
    Boolean(card.source_id) &&
    !undone;
  const canEditScope = canUndoPayment;

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
            {effectiveScopeLabel ? (
              <div className="mt-2 grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
                <p className="font-semibold text-textMute">Nhóm</p>
                <p className="font-semibold text-inkDeep">{effectiveScopeLabel}</p>
              </div>
            ) : null}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={`flex items-center gap-2 text-[16px] font-semibold leading-6 ${
                effectiveTone === "dismissed" ? "text-textMute" : "text-paid"
              }`}
            >
              {effectiveTone === "committed" ? (
                <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
              ) : null}
              {effectiveText}
            </p>
            {canUndoPayment || canEditScope ? (
              <div className="flex flex-wrap items-center gap-2">
                {canEditScope ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
                    onClick={() => setScopeModalOpen(true)}
                  >
                    Đổi nhóm
                  </Button>
                ) : null}
                {canUndoPayment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
                    onClick={() => setUndoModalOpen(true)}
                  >
                    Hoàn tác
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canUndoPayment && card.source_id ? (
          <PaymentUndoModal
            open={undoModalOpen}
            paymentId={card.source_id}
            amount={card.amount}
            entityName={card.entity_name}
            businessDate={card.business_date}
            onClose={() => setUndoModalOpen(false)}
            onUndone={() => {
              setUndoModalOpen(false);
              onUndone?.();
            }}
          />
        ) : null}

        {canEditScope && card.source_id ? (
          <PaymentScopeModal
            open={scopeModalOpen}
            paymentId={card.source_id}
            messageId={messageId}
            currentScopeLabel={effectiveScopeLabel}
            onClose={() => setScopeModalOpen(false)}
            onScopeChanged={(newLabel) => {
              setScopeModalOpen(false);
              setScopeOverride({ label: newLabel });
              onScopeChanged?.();
            }}
          />
        ) : null}
      </article>
    </div>
  );
}
