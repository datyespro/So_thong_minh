import type { ProductsTableRow } from "./products-table";
import type { CreatedProductView } from "@/app/(app)/chat/actions";

export function upsertProductSorted(
  list: ProductsTableRow[],
  created: CreatedProductView
): { newList: ProductsTableRow[]; isDuplicate: boolean } {
  const existingIndex = list.findIndex((p) => p.id === created.id);
  if (existingIndex >= 0) {
    return { newList: list, isDuplicate: true };
  }

  const newRow: ProductsTableRow = {
    id: created.id,
    name: created.name,
    unit: created.unit,
    sell_price: created.sell_price,
    current_stock: 0,
    category_id: null,
  };

  const newList = [...list, newRow];
  newList.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { newList, isDuplicate: false };
}

export function removeProductById(
  list: ProductsTableRow[],
  id: string
): ProductsTableRow[] {
  return list.filter((p) => p.id !== id);
}

// Bỏ dấu tiếng Việt + hạ thường để tìm kiếm "gõ không dấu vẫn ra".
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// Bộ lọc danh mục cho thanh chip: tất cả / chưa phân loại / một danh mục cụ thể.
export type ProductCategoryFilter =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: string };

// Lọc client-side theo tên (không dấu) + danh mục. Thuần để test được.
export function filterProducts(
  list: ProductsTableRow[],
  query: string,
  filter: ProductCategoryFilter
): ProductsTableRow[] {
  const normalizedQuery = normalizeSearchText(query);

  return list.filter((product) => {
    if (
      normalizedQuery &&
      !normalizeSearchText(product.name).includes(normalizedQuery)
    ) {
      return false;
    }

    if (filter.kind === "uncategorized") {
      return product.category_id === null;
    }

    if (filter.kind === "category") {
      return product.category_id === filter.id;
    }

    return true;
  });
}

// Đếm số hàng theo từng danh mục + nhóm chưa phân loại + tổng (cho số trên chip).
export function countProductsByCategory(list: ProductsTableRow[]): {
  total: number;
  uncategorized: number;
  byId: Record<string, number>;
} {
  const byId: Record<string, number> = {};
  let uncategorized = 0;

  for (const product of list) {
    if (product.category_id === null) {
      uncategorized += 1;
    } else {
      byId[product.category_id] = (byId[product.category_id] ?? 0) + 1;
    }
  }

  return { total: list.length, uncategorized, byId };
}

