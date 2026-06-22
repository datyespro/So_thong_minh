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

