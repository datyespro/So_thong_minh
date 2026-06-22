"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Tags } from "lucide-react";
import { listCategories, updatePaymentScope } from "@/app/(app)/chat/actions";
import type { CategoryView } from "@/src/lib/products/category";
import { Button } from "@/src/components/ui/button";

// DC-4b: đổi/bỏ nhãn nhóm cho cọc CŨ. Mirror payment-undo-modal (createPortal, ESC,
// click-outside, pure dialog content test renderToStaticMarkup). Value null = "Chung".
const GENERAL_SCOPE_VALUE = "__general__"; // sentinel cho <select> (null không dùng được làm value)

export type PaymentScopeModalProps = {
  open: boolean;
  paymentId: string;
  messageId?: string;
  currentScopeLabel: string | null;
  onClose: () => void;
  onScopeChanged: (newLabel: string | null) => void;
  // Tiêm action để test (mặc định = server actions thật).
  loadCategories?: typeof listCategories;
  saveScope?: typeof updatePaymentScope;
};

export function PaymentScopeDialogContent({
  titleId,
  descriptionId,
  categories,
  loading,
  selectedValue,
  submitting,
  errorText,
  cancelButtonRef,
  onSelect,
  onClose,
  onSave,
}: {
  titleId: string;
  descriptionId: string;
  categories: CategoryView[];
  loading: boolean;
  selectedValue: string; // id danh mục hoặc GENERAL_SCOPE_VALUE
  submitting: boolean;
  errorText: string | null;
  cancelButtonRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
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
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paperWarm text-stamp">
          <Tags className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3
            id={titleId}
            className="font-display text-2xl font-semibold leading-8 tracking-normal text-inkDeep"
          >
            Đổi nhóm cho khoản cọc này?
          </h3>
          <p id={descriptionId} className="mt-2 text-[16px] leading-7 text-textMute">
            Chỉ đổi nhãn nhóm — không ảnh hưởng số tiền hay công nợ.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${titleId}-select`}
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp"
        >
          Nhóm
        </label>
        <select
          id={`${titleId}-select`}
          value={selectedValue}
          disabled={loading || submitting}
          onChange={(event) => onSelect(event.target.value)}
          className="mt-1 h-12 w-full rounded border border-ledgerBorder bg-paper px-3 text-[16px] text-ink outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-55"
        >
          <option value={GENERAL_SCOPE_VALUE}>Chung (bỏ nhóm)</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {loading ? (
          <p className="mt-2 text-[14px] leading-6 text-textMute">
            Đang tải danh mục…
          </p>
        ) : null}
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
          disabled={submitting || loading}
          className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onSave}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Lưu
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

export function PaymentScopeModal({
  open,
  paymentId,
  messageId,
  currentScopeLabel,
  onClose,
  onScopeChanged,
  loadCategories = listCategories,
  saveScope = updatePaymentScope,
}: PaymentScopeModalProps) {
  const [categories, setCategories] = useState<CategoryView[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState(GENERAL_SCOPE_VALUE);

  const titleId = React.useId();
  const descriptionId = React.useId();
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  // Nạp danh mục khi mở; preselect theo currentScopeLabel (tên active duy nhất/owner).
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorText(null);

    void (async () => {
      const result = await loadCategories();

      if (cancelled) {
        return;
      }

      if (result.ok) {
        setCategories(result.data);
        const match = currentScopeLabel
          ? result.data.find((category) => category.name === currentScopeLabel)
          : undefined;
        setSelectedValue(match ? match.id : GENERAL_SCOPE_VALUE);
      } else {
        setErrorText(result.message);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, currentScopeLabel, loadCategories]);

  useEffect(() => {
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

  const handleSave = async () => {
    if (submitting || loading) {
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    const scopeCategoryId =
      selectedValue === GENERAL_SCOPE_VALUE ? null : selectedValue;

    try {
      const result = await saveScope(paymentId, scopeCategoryId, messageId);

      if (result.ok) {
        onScopeChanged(result.data.scope_label);
        return;
      }

      setErrorText(result.message);
      setSubmitting(false);
    } catch (error) {
      console.error("Failed to update payment scope", error);
      setErrorText("Chưa đổi nhóm được, bác thử lại ạ.");
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-inkDeep/45 px-4 py-6 backdrop-blur-[1px]"
      data-testid="payment-scope-modal"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <PaymentScopeDialogContent
        titleId={titleId}
        descriptionId={descriptionId}
        categories={categories}
        loading={loading}
        selectedValue={selectedValue}
        submitting={submitting}
        errorText={errorText}
        cancelButtonRef={cancelButtonRef}
        onSelect={setSelectedValue}
        onClose={onClose}
        onSave={() => void handleSave()}
      />
    </div>,
    document.body,
  );
}
