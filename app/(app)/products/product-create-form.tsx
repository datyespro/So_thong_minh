"use client";

import * as React from "react";
import { Plus, Save, X } from "lucide-react";
import { createProduct } from "@/app/(app)/chat/actions";
import { Button } from "@/src/components/ui/button";
import { upsertProductSorted } from "./product-list-utils";
import type { ProductsTableRow } from "./products-table";

const PRODUCT_UNIT_SUGGESTIONS = ["viên", "bao", "cây", "cái", "m³"];

export function ProductCreateForm({
  products,
  onCreated,
}: {
  products: ProductsTableRow[];
  onCreated: (newList: ProductsTableRow[]) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [sellPrice, setSellPrice] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="mb-4 h-10 border-ledgerBorder bg-surface text-inkDeep hover:bg-paperWarm"
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Thêm sản phẩm
      </Button>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên sản phẩm không được để trống.");
      return;
    }
    setError(null);
    setIsSaving(true);
    
    try {
      const result = await createProduct(
        name.trim(),
        unit.trim() || undefined,
        sellPrice.trim() || undefined
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const { newList, isDuplicate } = upsertProductSorted(products, result.data);
      if (isDuplicate) {
        setError("Đã có hàng này rồi ạ.");
        return;
      }

      onCreated(newList);
      setIsOpen(false);
      setName("");
      setUnit("");
      setSellPrice("");
    } catch (err) {
      console.error("createProduct failed", err);
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded border border-ledgerBorder bg-surface p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-inkDeep">
        Thêm sản phẩm
      </h2>
      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="product-name" className="mb-1 block text-sm font-medium text-textMain">
            Tên <span className="text-debt">*</span>
          </label>
          <input
            id="product-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
            placeholder="Ví dụ: Xi măng Hà Tiên"
            className="h-10 w-full rounded border border-stamp/35 bg-paper px-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="product-unit" className="mb-1 block text-sm font-medium text-textMain">
            Đơn vị
          </label>
          <input
            id="product-unit"
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            disabled={isSaving}
            placeholder="Đơn vị (có thể bỏ trống)"
            className="mb-2 h-10 w-full rounded border border-stamp/35 bg-paper px-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex flex-wrap gap-1.5">
            {PRODUCT_UNIT_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isSaving}
                onClick={() => setUnit(suggestion)}
                className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
                  unit === suggestion
                    ? "bg-paperWarm text-ink ring-1 ring-stamp"
                    : "border border-ledgerBorder bg-surface text-textMute hover:bg-paperWarm hover:text-textMain"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="product-price" className="mb-1 block text-sm font-medium text-textMain">
            Giá bán
          </label>
          <input
            id="product-price"
            type="text"
            inputMode="numeric"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            disabled={isSaving}
            placeholder="Để trống nếu chưa có"
            className="h-10 w-full rounded border border-stamp/35 bg-paper px-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        
        {error && (
          <div className="sm:col-span-3">
            <p className="text-[15px] leading-6 text-debt" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 sm:col-span-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => setIsOpen(false)}
            className="h-10 border-ledgerBorder bg-surface text-textMute hover:bg-paperWarm hover:text-ink"
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 bg-ink text-paper hover:bg-inkDeep"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
