"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Trash2, ClipboardCheck } from "lucide-react";
import { updateProduct } from "@/app/(app)/chat/actions";
import { formatUnitDisplay } from "@/src/lib/format/unit";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import {
  coerceProductNumber,
  formatProductSellPrice,
  formatProductStock,
  isNegativeProductStock,
  type ProductNumericValue,
} from "@/src/lib/products/display";
import { ProductCreateForm } from "./product-create-form";
import { ProductDeleteModal } from "./product-delete-modal";
import { ProductAdjustStockModal } from "./product-adjust-stock-modal";
import { removeProductById } from "./product-list-utils";

export type ProductsTableRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: ProductNumericValue;
  current_stock: ProductNumericValue;
};

const PRODUCT_GRID_COLUMNS =
  "sm:grid-cols-[minmax(0,1.7fr)_0.7fr_0.9fr_0.8fr_auto]";

type DraftState = {
  name: string;
  unit: string;
  sellPrice: string;
};

function ProductField({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="mt-2 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:mt-0 sm:block">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function priceDraftValue(value: ProductNumericValue) {
  const numeric = coerceProductNumber(value);

  return numeric === null ? "" : String(Math.round(numeric));
}

function applyUpdatedProduct(
  products: ProductsTableRow[],
  updated: Readonly<{ id: string; name: string; unit: string; sell_price: number | null }>,
) {
  return products.map((product) =>
    product.id === updated.id
      ? {
          ...product,
          name: updated.name,
          unit: updated.unit,
          sell_price: updated.sell_price,
        }
      : product,
  );
}

export function ProductsTable({
  initialProducts,
}: Readonly<{
  initialProducts: ProductsTableRow[];
}>) {
  const router = useRouter();
  const [products, setProducts] = React.useState(initialProducts);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftState>({
    name: "",
    unit: "",
    sellPrice: "",
  });
  const [errorByProduct, setErrorByProduct] = React.useState<Record<string, string>>(
    {},
  );
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<ProductsTableRow | null>(null);
  const [adjustingProduct, setAdjustingProduct] = React.useState<ProductsTableRow | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  function handleStartEdit(product: ProductsTableRow) {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      unit: product.unit,
      sellPrice: priceDraftValue(product.sell_price),
    });
    setErrorByProduct((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
  }

  function handleCancelEdit(productId: string) {
    setEditingId(null);
    setDraft({ name: "", unit: "", sellPrice: "" });
    setErrorByProduct((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  async function handleSave(productId: string) {
    setSavingId(productId);
    setErrorByProduct((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });

    try {
      const result = await updateProduct(productId, {
        name: draft.name,
        unit: draft.unit,
        sell_price: draft.sellPrice,
      });

      if (!result.ok) {
        setErrorByProduct((current) => ({
          ...current,
          [productId]: result.message,
        }));
        return;
      }

      setProducts((current) => applyUpdatedProduct(current, result.data));
      setEditingId(null);
      setDraft({ name: "", unit: "", sellPrice: "" });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("updateProduct failed", error);
      setErrorByProduct((current) => ({
        ...current,
        [productId]: "Chưa sửa được hàng, bác thử lại ạ.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <ProductCreateForm products={products} onCreated={setProducts} />
      <ProductDeleteModal
        product={deletingProduct}
        isOpen={deletingProduct !== null}
        onClose={() => setDeletingProduct(null)}
        onDeleted={(id) => setProducts(removeProductById(products, id))}
      />
      <ProductAdjustStockModal
        product={adjustingProduct}
        isOpen={adjustingProduct !== null}
        onClose={() => setAdjustingProduct(null)}
        onAdjusted={(id, newStock) => {
          setProducts((current) =>
            current.map((p) => (p.id === id ? { ...p, current_stock: newStock } : p))
          );
          setAdjustingProduct(null);
          startTransition(() => {
            router.refresh();
          });
        }}
      />
      
      {products.length === 0 ? (
        <div className="rounded border border-ledgerBorder bg-surface px-4 py-10 text-center">
          <p className="font-display text-xl font-semibold text-inkDeep">Chưa có hàng nào.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-ledgerBorder bg-surface">
          <div
        className={cn(
          "hidden gap-2 bg-paperWarm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp sm:grid",
          PRODUCT_GRID_COLUMNS,
        )}
      >
        <span>Tên</span>
        <span>Đơn vị</span>
        <span>Giá bán</span>
        <span>Tồn kho</span>
        <span className="text-right">Thao tác</span>
      </div>
      <div className="divide-y divide-ledgerBorder">
        {products.map((product) => {
          const stockIsNegative = isNegativeProductStock(product.current_stock);
          const isEditing = editingId === product.id;
          const isSaving = savingId === product.id;
          const error = errorByProduct[product.id] ?? null;

          return (
            <div
              key={product.id}
              className={cn(
                "block px-3 py-3 text-[16px] leading-7 sm:grid sm:items-start sm:gap-2",
                PRODUCT_GRID_COLUMNS,
              )}
            >
              <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:block">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                  Tên
                </p>
                {isEditing ? (
                  <label>
                    <span className="sr-only">Sửa tên {product.name}</span>
                    <input
                      type="text"
                      value={draft.name}
                      disabled={isSaving}
                      className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <p className="truncate font-semibold text-inkDeep">{product.name}</p>
                )}
              </div>
              <ProductField label="Đơn vị">
                {isEditing ? (
                  <label>
                    <span className="sr-only">Sửa đơn vị {product.name}</span>
                    <input
                      type="text"
                      value={draft.unit}
                      disabled={isSaving}
                      placeholder="Đơn vị (có thể bỏ trống)"
                      className="h-11 w-full min-w-[96px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          unit: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <p className="font-semibold text-textMute">{formatUnitDisplay(product.unit) || "—"}</p>
                )}
              </ProductField>
              <ProductField label="Giá bán">
                {isEditing ? (
                  <label>
                    <span className="sr-only">Sửa giá bán {product.name}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.sellPrice}
                      disabled={isSaving}
                      placeholder="Để trống nếu chưa có"
                      className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          sellPrice: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <p className="font-semibold">
                    {formatProductSellPrice(product.sell_price)}
                  </p>
                )}
              </ProductField>
              <ProductField label="Tồn kho">
                <p
                  className={cn(
                    "font-semibold",
                    stockIsNegative ? "text-debt" : "text-textMain",
                  )}
                >
                  {formatProductStock(product.current_stock)}
                </p>
              </ProductField>
              <ProductField label="Thao tác">
                <div className="flex justify-end gap-2 sm:justify-end">
                  {isEditing ? (
                    <>
                      <Button
                        type="button"
                        disabled={isSaving}
                        className="h-10 rounded bg-ink px-3 text-[15px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => void handleSave(product.id)}
                      >
                        <Save className="h-4 w-4" aria-hidden="true" />
                        {isSaving ? "Đang lưu..." : "Lưu"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        className="h-10 rounded border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => handleCancelEdit(product.id)}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        title={`Sửa ${product.name}`}
                        aria-label={`Sửa ${product.name}`}
                        className="h-10 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-ink"
                        onClick={() => handleStartEdit(product)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        title={`Kiểm kho ${product.name}`}
                        aria-label={`Kiểm kho ${product.name}`}
                        className="h-10 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-ink"
                        onClick={() => setAdjustingProduct(product)}
                      >
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        title={`Xóa ${product.name}`}
                        aria-label={`Xóa ${product.name}`}
                        className="h-10 rounded border-ledgerBorder bg-surface px-3 text-textMute hover:bg-paperWarm hover:text-debt"
                        onClick={() => setDeletingProduct(product)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </ProductField>
              {isEditing && error ? (
                <p
                  className="mt-2 text-[15px] leading-6 text-debt sm:col-span-5"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
        </div>
      )}
    </div>
  );
}
