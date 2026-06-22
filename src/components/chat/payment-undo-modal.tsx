"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, Loader2 } from "lucide-react";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { undoCommit } from "@/app/(app)/chat/actions";
import { resolveUndoOutcome } from "@/src/components/customers/order-delete-modal";
import { dayjs } from "@/src/lib/dayjs";
import { Button } from "@/src/components/ui/button";

export type PaymentUndoModalProps = {
  open: boolean;
  paymentId: string;
  amount: number | null;
  entityName: string | null;
  businessDate?: string | null;
  onClose: () => void;
  onUndone: () => void;
  undoAction?: (
    target: "payment",
    id: string
  ) => Promise<{ ok: boolean; data?: { already_undone?: boolean } | unknown }>;
};

// Tách quyết định undo ra hàm test được (không jsdom): gọi undoAction("payment",id),
// map qua resolveUndoOutcome (reuse DEL-1) → chạy onUndone hoặc onError.
export async function performPaymentUndo({
  undoAction,
  paymentId,
  onUndone,
  onError,
}: {
  undoAction: NonNullable<PaymentUndoModalProps["undoAction"]>;
  paymentId: string;
  onUndone: () => void;
  onError: () => void;
}): Promise<"deleted" | "error"> {
  try {
    const res = await undoAction("payment", paymentId);
    const outcome = resolveUndoOutcome(res);
    if (outcome === "deleted") {
      onUndone();
      return "deleted";
    }
    onError();
    return "error";
  } catch (e) {
    console.error("Failed to undo payment", e);
    onError();
    return "error";
  }
}

export function formatPaymentUndoSummaryLine({
  businessDate,
  entityName,
  amount,
}: {
  businessDate?: string | null;
  entityName: string | null;
  amount: number | null;
}) {
  const dateStr =
    businessDate && dayjs(businessDate).isValid()
      ? dayjs(businessDate).format("DD/MM/YYYY")
      : null;
  const nameStr = entityName?.trim() || "Khách lẻ";
  const moneyStr =
    amount === null || !Number.isFinite(amount)
      ? "—"
      : formatVietnameseMoney(amount);
  return { dateStr, nameStr, moneyStr };
}

export function PaymentUndoDialogContent({
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
            Hoàn tác khoản thu này?
          </h3>
          <div id={descriptionId} className="mt-2 text-[16px] leading-7 text-textMute">
            <div>
              {dateStr ? `${dateStr} • ` : ""}
              <span className="font-medium">{nameStr}</span> •{" "}
              <span className="font-semibold">{moneyStr} đ</span>
            </div>
            <div className="mt-3 text-sm text-debt">
              Công nợ sẽ được hoàn lại. Thao tác này không hoàn lại được — nếu cần, bác ghi lại ạ.
            </div>
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

export function PaymentUndoModal({
  open,
  paymentId,
  amount,
  entityName,
  businessDate = null,
  onClose,
  onUndone,
  undoAction = undoCommit as unknown as PaymentUndoModalProps["undoAction"],
}: PaymentUndoModalProps) {
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

  const { dateStr, nameStr, moneyStr } = formatPaymentUndoSummaryLine({
    businessDate,
    entityName,
    amount,
  });

  const handleUndo = async () => {
    if (submitting || !undoAction) return;
    setSubmitting(true);
    setErrorText(null);

    await performPaymentUndo({
      undoAction,
      paymentId,
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
      data-testid="payment-undo-modal"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <PaymentUndoDialogContent
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
