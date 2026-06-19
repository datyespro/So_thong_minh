"use client";

import * as React from "react";
import { Package } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { adjustProductStock } from "@/app/(app)/chat/actions";
import { coerceProductNumber, formatProductStock } from "@/src/lib/products/display";
import type { ProductsTableRow } from "./products-table";

type ProductAdjustStockModalProps = Readonly<{
  product: ProductsTableRow | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjusted: (id: string, newStock: number) => void;
}>;

export function ProductAdjustStockModal({
  product,
  isOpen,
  onClose,
  onAdjusted,
}: ProductAdjustStockModalProps) {
  const [newQuantityStr, setNewQuantityStr] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setNewQuantityStr("");
      setNote("");
      setError(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen && !isSaving) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !product) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedQuantity = coerceProductNumber(newQuantityStr);

    if (parsedQuantity === null || !Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setError("Số lượng thực tế không hợp lệ.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await adjustProductStock(product!.id, parsedQuantity, note);
      
      if (!result.ok) {
        setError(result.message);
        return;
      }

      if (result.data.adjusted === false) {
        setError("Tồn kho đã đúng, không cần điều chỉnh ạ.");
        return;
      }

      onAdjusted(product!.id, result.data.current_stock);
    } catch (error) {
      console.error("Failed to adjust product stock", error);
      setError("Đã có lỗi xảy ra, bác thử lại ạ.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-paperDeep/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={isSaving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adjust-modal-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2 p-4 outline-none"
      >
        <div className="rounded-lg border border-ledgerBorder bg-surface p-6 shadow-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paperNote text-inkDeep">
              <Package className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="adjust-modal-title"
                className="text-[17px] font-semibold text-inkDeep"
              >
                Kiểm kho
              </h2>
              <p className="mt-0.5 text-[15px] font-medium text-textMain">
                {product.name}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-[14px] font-medium text-textMute mb-1">Tồn hiện tại trên máy:</p>
              <p className="text-[16px] font-semibold text-textMain">
                {formatProductStock(product.current_stock)} {product.unit}
              </p>
            </div>

            <div>
              <label className="block text-[14px] font-medium text-textMute mb-1" htmlFor="newQuantityInput">
                Số thực tế đếm được:
              </label>
              <input
                id="newQuantityInput"
                type="text"
                inputMode="decimal"
                required
                disabled={isSaving}
                autoFocus
                value={newQuantityStr}
                onChange={(e) => setNewQuantityStr(e.target.value)}
                className="h-11 w-full rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none focus:border-ink disabled:opacity-60"
                placeholder="Ví dụ: 45"
              />
            </div>

            <div>
              <label className="block text-[14px] font-medium text-textMute mb-1" htmlFor="noteInput">
                Ghi chú (tùy chọn):
              </label>
              <input
                id="noteInput"
                type="text"
                disabled={isSaving}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-11 w-full rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none focus:border-ink disabled:opacity-60"
                placeholder="Ví dụ: đếm lại cuối ngày"
              />
            </div>

            {error ? (
              <p className="text-[15px] leading-6 text-debt" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                className="h-10 rounded border-ledgerBorder bg-surface px-4 font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:opacity-55"
                onClick={onClose}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSaving || !newQuantityStr.trim()}
                className="h-10 rounded bg-ink px-4 font-semibold text-paper hover:bg-inkDeep disabled:opacity-55"
              >
                {isSaving ? "Đang lưu..." : "Điều chỉnh"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
