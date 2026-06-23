"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, Loader2 } from "lucide-react";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { undoCommit } from "@/app/(app)/chat/actions";
import { resolveUndoOutcome } from "@/src/components/customers/order-delete-modal";
import { dayjs } from "@/src/lib/dayjs";
import { Button } from "@/src/components/ui/button";

export type OrderUndoTarget = "order" | "purchase";

export type OrderUndoModalProps = {
  open: boolean;
  target: OrderUndoTarget;
  commitId: string;
  entityName: string | null;
  totalAmount: number | null;
  businessDate?: string | null;
  onClose: () => void;
  onUndone: () => void;
  undoAction?: (
    target: OrderUndoTarget,
    id: string
  ) => Promise<{ ok: boolean; data?: { already_undone?: boolean } | unknown }>;
};

// Copy đổi theo target. order: hoàn cả tồn + nợ; purchase: chỉ hoàn tồn (đơn nhập
// không sinh nợ khách). Tách ra để OrderUndoDialogContent test được không cần jsdom.
const COPY: Record<
  OrderUndoTarget,
  { title: string; warning: string; emptyName: string }
> = {
  order: {
    title: "Hoàn tác đơn bán này?",
    warning:
      "Tồn kho và công nợ sẽ được hoàn lại. Thao tác này không hoàn lại được — nếu cần, bác ghi lại ạ.",
    emptyName: "Khách lẻ",
  },
  purchase: {
    title: "Hoàn tác đơn nhập này?",
    warning:
      "Tồn kho sẽ được hoàn lại. Thao tác này không hoàn lại được — nếu cần, bác ghi lại ạ.",
    emptyName: "Chưa có NCC",
  },
};

// Tách quyết định undo ra hàm test được (không jsdom): gọi undoAction(target,id),
// map qua resolveUndoOutcome (reuse DEL-1) → chạy onUndone hoặc onError. ok:true kể cả
// already_undone đều ra "deleted" → idempotent (gọi 2 lần không nhân đôi tồn/nợ).
export async function performOrderUndo({
  undoAction,
  target,
  commitId,
  onUndone,
  onError,
}: {
  undoAction: NonNullable<OrderUndoModalProps["undoAction"]>;
  target: OrderUndoTarget;
  commitId: string;
  onUndone: () => void;
  onError: () => void;
}): Promise<"deleted" | "error"> {
  try {
    const res = await undoAction(target, commitId);
    const outcome = resolveUndoOutcome(res);
    if (outcome === "deleted") {
      onUndone();
      return "deleted";
    }
    onError();
    return "error";
  } catch (e) {
    console.error("Failed to undo order/purchase", e);
    onError();
    return "error";
  }
}

export function formatOrderUndoSummaryLine({
  target,
  businessDate,
  entityName,
  totalAmount,
}: {
  target: OrderUndoTarget;
  businessDate?: string | null;
  entityName: string | null;
  totalAmount: number | null;
}) {
  const dateStr =
    businessDate && dayjs(businessDate).isValid()
      ? dayjs(businessDate).format("DD/MM/YYYY")
      : null;
  const nameStr = entityName?.trim() || COPY[target].emptyName;
  const moneyStr =
    totalAmount === null || !Number.isFinite(totalAmount)
      ? "—"
      : formatVietnameseMoney(totalAmount);
  return { dateStr, nameStr, moneyStr };
}

export function OrderUndoDialogContent({
  target,
  titleId,
  descriptionId,
  dateStr,
  nameStr,
  moneyStr,
  submitting,
  errorText,
  cancelButtonRef,
  onClose,
  onUndo,
}: {
  target: OrderUndoTarget;
  titleId: string;
  descriptionId: string;
  dateStr: string | null;
  nameStr: string;
  moneyStr: string;
  submitting: boolean;
  errorText: string | null;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onUndo: () => void;
}) {
  return (
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
            {COPY[target].title}
          </h3>
          <div id={descriptionId} className="mt-2 text-[16px] leading-7 text-textMute">
            <div>
              {dateStr ? `${dateStr} • ` : ""}
              <span className="font-medium">{nameStr}</span> •{" "}
              <span className="font-semibold">{moneyStr} đ</span>
            </div>
            <div className="mt-3 text-sm text-debt">{COPY[target].warning}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          ref={cancelButtonRef}
          type="button"
          variant="outline"
          disabled={submitting}
          className="h-12 rounded border-ledgerBorder bg-surface px-5 text-[16px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onClose}
        >
          Hủy
        </Button>
        <Button
          type="button"
          disabled={submitting}
          className="h-12 rounded bg-debt px-5 text-[16px] font-semibold text-paper hover:bg-debt/90 disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onUndo}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Hoàn tác
        </Button>
      </div>

      {errorText ? (
        <p className="mt-3 text-[15px] leading-6 text-debt" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

export function OrderUndoModal({
  open,
  target,
  commitId,
  entityName,
  totalAmount,
  businessDate = null,
  onClose,
  onUndone,
  undoAction = undoCommit as unknown as OrderUndoModalProps["undoAction"],
}: OrderUndoModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault();
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    cancelButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, submitting, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const { dateStr, nameStr, moneyStr } = formatOrderUndoSummaryLine({
    target,
    businessDate,
    entityName,
    totalAmount,
  });

  const handleUndo = async () => {
    if (submitting || !undoAction) return;
    setSubmitting(true);
    setErrorText(null);

    await performOrderUndo({
      undoAction,
      target,
      commitId,
      onUndone,
      onError: () => {
        setErrorText("Chưa hoàn tác được, bác thử lại ạ.");
        setSubmitting(false);
      },
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-inkDeep/45 px-4 py-6 backdrop-blur-[1px]"
      data-testid="order-undo-modal"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <OrderUndoDialogContent
        target={target}
        titleId={titleId}
        descriptionId={descriptionId}
        dateStr={dateStr}
        nameStr={nameStr}
        moneyStr={moneyStr}
        submitting={submitting}
        errorText={errorText}
        cancelButtonRef={cancelButtonRef}
        onClose={onClose}
        onUndo={() => void handleUndo()}
      />
    </div>,
    document.body,
  );
}
