import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import type { ProductNumericValue } from "@/src/lib/products/display";
import type { CategoryView } from "@/src/lib/products/category";
import { createClient } from "@/src/lib/supabase/server";
import { ProductsTable } from "@/app/(app)/products/products-table";

type ProductRow = {
  id: string;
  name: string;
  unit: string;
  sell_price: ProductNumericValue;
  current_stock: ProductNumericValue;
  category_id: string | null;
};


export default async function ProductsPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("id,name,unit,sell_price,current_stock,category_id")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.warn("Failed to load products", {
      code: error.code,
      message: error.message,
    });
  }

  const products = (data ?? []) as ProductRow[];

  const { data: categoryData, error: categoryError } = await supabase
    .from("product_categories")
    .select("id,name")
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (categoryError) {
    console.warn("Failed to load product categories", {
      code: categoryError.code,
      message: categoryError.message,
    });
  }

  const categories = (categoryData ?? []) as CategoryView[];

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 border-b border-ledgerBorder pb-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            Master data
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal text-inkDeep">
            Sản phẩm
          </h1>
        </div>

        <ProductsTable initialProducts={products} initialCategories={categories} />
      </div>
    </section>
  );
}
