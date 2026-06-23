"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardCheck,
  Pencil,
  Plus,
  Save,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
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
import { CategoryManageModal } from "./category-manage-modal";
import {
  countProductsByCategory,
  filterProducts,
  removeProductById,
  type ProductCategoryFilter,
} from "./product-list-utils";
import type { CategoryView } from "@/src/lib/products/category";

export type ProductsTableRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: ProductNumericValue;
  current_stock: ProductNumericValue;
  category_id: string | null;
};

const PRODUCT_GRID_COLUMNS =
  "sm:grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_0.7fr_0.9fr_auto]";

const UNCATEGORIZED_LABEL = "Chưa phân loại";
const NEGATIVE_STOCK_HINT =
  "Đã bán/xuất nhiều hơn tồn đã nhập. Kiểm kho lại nhé.";

function FilterChip({
  label,
  count,
  active,
  onClick,
}: Readonly<{
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded border px-3.5 text-[14px] font-medium whitespace-nowrap",
        active
          ? "border-stamp bg-paperWarm font-semibold text-inkDeep ring-1 ring-stamp"
          : "border-ledgerBorder bg-surface text-textMain hover:bg-paperWarm hover:text-ink",
      )}
    >
      {label}
      <span className={cn("font-semibold", active ? "text-stamp" : "text-textFaint")}>
        {count}
      </span>
    </button>
  );
}

type DraftState = {
  name: string;
  unit: string;
  sellPrice: string;
  categoryId: string;
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
  updated: Readonly<{
    id: string;
    name: string;
    unit: string;
    sell_price: number | null;
    category_id: string | null;
  }>,
) {
  return products.map((product) =>
    product.id === updated.id
      ? {
          ...product,
          name: updated.name,
          unit: updated.unit,
          sell_price: updated.sell_price,
          category_id: updated.category_id,
        }
      : product,
  );
}

export function ProductsTable({
  initialProducts,
  initialCategories,
}: Readonly<{
  initialProducts: ProductsTableRow[];
  initialCategories: CategoryView[];
}>) {
  const router = useRouter();
  const [products, setProducts] = React.useState(initialProducts);
  const [categories, setCategories] = React.useState(initialCategories);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftState>({
    name: "",
    unit: "",
    sellPrice: "",
    categoryId: "",
  });
  const [errorByProduct, setErrorByProduct] = React.useState<Record<string, string>>(
    {},
  );
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<ProductsTableRow | null>(null);
  const [adjustingProduct, setAdjustingProduct] = React.useState<ProductsTableRow | null>(null);
  const [isManagingCategories, setIsManagingCategories] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<ProductCategoryFilter>({
    kind: "all",
  });
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  React.useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const categoryNameById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const counts = React.useMemo(
    () => countProductsByCategory(products),
    [products],
  );

  const categoriesWithCount = React.useMemo(
    () => categories.filter((category) => (counts.byId[category.id] ?? 0) > 0),
    [categories, counts],
  );

  const visibleProducts = React.useMemo(
    () => filterProducts(products, searchQuery, categoryFilter),
    [products, searchQuery, categoryFilter],
  );

  const showFilterChips =
    categoriesWithCount.length > 0 || counts.uncategorized > 0;

  function handleStartEdit(product: ProductsTableRow) {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      unit: product.unit,
      sellPrice: priceDraftValue(product.sell_price),
      categoryId: product.category_id ?? "",
    });
    setErrorByProduct((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
  }

  function handleCancelEdit(productId: string) {
    setEditingId(null);
    setDraft({ name: "", unit: "", sellPrice: "", categoryId: "" });
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
        category_id: draft.categoryId === "" ? null : draft.categoryId,
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
      setDraft({ name: "", unit: "", sellPrice: "", categoryId: "" });
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-ledgerBorder pb-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            Master data
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-normal text-inkDeep">
            Sản phẩm
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
            onClick={() => setIsManagingCategories(true)}
          >
            <Tags className="mr-2 h-4 w-4" aria-hidden="true" />
            Quản lý danh mục
          </Button>
          <Button
            type="button"
            className="h-11 rounded bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-inkDeep"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Thêm sản phẩm
          </Button>
        </div>
      </div>

      <CategoryManageModal
        isOpen={isManagingCategories}
        categories={categories}
        onClose={() => setIsManagingCategories(false)}
        onChanged={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />
      <ProductCreateForm
        products={products}
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreated={setProducts}
      />
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
        <div className="rounded border border-dashed border-borderStrong bg-surface px-6 py-12 text-center">
          <p className="font-display text-[22px] font-semibold text-inkDeep">
            Chưa có hàng nào trong sổ.
          </p>
          <p className="mt-2 text-[15px] text-textMute">
            Thêm mặt hàng đầu tiên để bắt đầu ghi đơn và theo dõi tồn kho.
          </p>
          <Button
            type="button"
            className="mx-auto mt-4 h-11 rounded bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-inkDeep"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Thêm sản phẩm
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-textFaint"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm theo tên hàng…"
                aria-label="Tìm sản phẩm theo tên"
                className="h-11 w-full rounded border border-ledgerBorder bg-surface pl-10 pr-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink"
              />
            </div>
            {showFilterChips ? (
              <div className="flex flex-wrap items-center gap-2">
                <FilterChip
                  label="Tất cả"
                  count={counts.total}
                  active={categoryFilter.kind === "all"}
                  onClick={() => setCategoryFilter({ kind: "all" })}
                />
                {categoriesWithCount.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.name}
                    count={counts.byId[category.id] ?? 0}
                    active={
                      categoryFilter.kind === "category" &&
                      categoryFilter.id === category.id
                    }
                    onClick={() =>
                      setCategoryFilter({ kind: "category", id: category.id })
                    }
                  />
                ))}
                {counts.uncategorized > 0 ? (
                  <FilterChip
                    label={UNCATEGORIZED_LABEL}
                    count={counts.uncategorized}
                    active={categoryFilter.kind === "uncategorized"}
                    onClick={() => setCategoryFilter({ kind: "uncategorized" })}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {visibleProducts.length === 0 ? (
            <div className="rounded border border-dashed border-borderStrong bg-surface px-6 py-12 text-center">
              <p className="font-display text-xl font-semibold text-inkDeep">
                Không tìm thấy hàng nào khớp.
              </p>
              <p className="mt-2 text-[15px] text-textMute">
                Thử đổi từ khóa hoặc bỏ bớt bộ lọc danh mục.
              </p>
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
        <span>Danh mục</span>
        <span>Tồn kho</span>
        <span className="text-right">Thao tác</span>
      </div>
      <div className="divide-y divide-ledgerBorder">
        {visibleProducts.map((product) => {
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
              <ProductField label="Danh mục">
                {isEditing ? (
                  <label>
                    <span className="sr-only">Sửa danh mục {product.name}</span>
                    <select
                      value={draft.categoryId}
                      disabled={isSaving}
                      className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none focus:border-ink disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          categoryId: event.target.value,
                        }))
                      }
                    >
                      <option value="">— {UNCATEGORIZED_LABEL} —</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  (() => {
                    const categoryLabel =
                      product.category_id !== null
                        ? categoryNameById.get(product.category_id) ??
                          UNCATEGORIZED_LABEL
                        : UNCATEGORIZED_LABEL;
                    const isUncategorized = categoryLabel === UNCATEGORIZED_LABEL;
                    return (
                      <p
                        className={
                          isUncategorized
                            ? "font-medium text-textFaint"
                            : "font-semibold text-inkDeep"
                        }
                      >
                        {categoryLabel}
                      </p>
                    );
                  })()
                )}
              </ProductField>
              <ProductField label="Tồn kho">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-mono font-semibold",
                    stockIsNegative ? "text-debt" : "text-textMain",
                  )}
                >
                  {formatProductStock(product.current_stock)}
                  {stockIsNegative ? (
                    <span
                      title={NEGATIVE_STOCK_HINT}
                      aria-label={`Tồn kho âm — ${NEGATIVE_STOCK_HINT}`}
                      className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-debt/10 text-debt"
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
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
                      <span
                        className="mx-1 h-6 w-px self-center bg-ledgerBorder"
                        aria-hidden="true"
                      />
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
                  className="mt-2 text-[15px] leading-6 text-debt sm:col-span-6"
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
        </>
      )}
    </div>
  );
}
