"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert, Loader2 } from "lucide-react";
import { formatVietnameseMoney } from "@/src/lib/format/money";
import { undoCommit } from "@/app/(app)/chat/actions";
import { dayjs } from "@/src/lib/dayjs";
import { Button } from "@/src/components/ui/button";

export type OrderDeleteModalProps = {
  open: boolean;
  orderId: string;
  businessDate: string | null;
  total: number;
  itemCount: number;
  firstItemName: string | null;
  onClose: () => void;
  onDeleted: () => void;
  undoAction?: (
    target: "order",
    id: string
  ) => Promise<{ ok: boolean; data?: { already_undone?: boolean } | unknown }>;
};

export function resolveUndoOutcome(res: { ok: boolean; data?: { already_undone?: boolean } | unknown }): "deleted" | "error" {
  return res.ok === true ? "deleted" : "error";
}

export function formatDeleteSummaryLine({
  businessDate,
  firstItemName,
  itemCount,
  total,
}: {
  businessDate: string | null;
  firstItemName: string | null;
  itemCount: number;
  total: number;
}) {
  const dateStr = businessDate
    ? dayjs(businessDate).isValid()
      ? dayjs(businessDate).format("DD/MM/YYYY")
      : "—"
    : "—";
  const nameStr = firstItemName ?? "—";
  const suffix = itemCount > 1 ? ` … (${itemCount} món)` : "";
  const moneyStr = formatVietnameseMoney(total);
  return { dateStr, nameStr, suffix, moneyStr };
}

export function OrderDeleteDialogContent({
  titleId,
  descriptionId,
  dateStr,
  nameStr,
  suffix,
  moneyStr,
  submitting,
  errorText,
  cancelButtonRef,
  onClose,
  onDelete,
}: {
  titleId: string;
  descriptionId: string;
  dateStr: string;
  nameStr: string;
  suffix: string;
  moneyStr: string;
  submitting: boolean;
  errorText: string | null;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onDelete: () => void;
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
            Xóa đơn này?
          </h3>
          <div id={descriptionId} className="mt-2 text-[16px] leading-7 text-textMute">
            <div>
              {dateStr} • <span className="font-medium">{nameStr}{suffix}</span> • <span className="font-semibold">{moneyStr} đ</span>
            </div>
            <div className="mt-3 text-sm text-debt">
              Tồn kho và công nợ sẽ được hoàn lại. Thao tác này không hoàn lại được — nếu cần, bác gõ lại đơn ạ.
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
          onClick={onDelete}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Xóa đơn
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

export function OrderDeleteModal({
  open,
  orderId,
  businessDate,
  total,
  itemCount,
  firstItemName,
  onClose,
  onDeleted,
  undoAction = undoCommit as unknown as OrderDeleteModalProps["undoAction"],
}: OrderDeleteModalProps) {
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

  const { dateStr, nameStr, suffix, moneyStr } = formatDeleteSummaryLine({
    businessDate,
    firstItemName,
    itemCount,
    total,
  });

  const handleDelete = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorText(null);

    try {
      if (!undoAction) return;
      const res = await undoAction("order", orderId);
      const outcome = resolveUndoOutcome(res);
      if (outcome === "deleted") {
        onDeleted();
      } else {
        setErrorText("Chưa xóa được, bác thử lại ạ.");
        setSubmitting(false);
      }
    } catch (e) {
      console.error("Failed to undo order", e);
      setErrorText("Chưa xóa được, bác thử lại ạ.");
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-inkDeep/45 px-4 py-6 backdrop-blur-[1px]"
      data-testid="order-delete-modal"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <OrderDeleteDialogContent
        titleId={titleId}
        descriptionId={descriptionId}
        dateStr={dateStr}
        nameStr={nameStr}
        suffix={suffix}
        moneyStr={moneyStr}
        submitting={submitting}
        errorText={errorText}
        cancelButtonRef={cancelButtonRef}
        onClose={onClose}
        onDelete={() => void handleDelete()}
      />
    </div>,
    document.body,
  );
}
