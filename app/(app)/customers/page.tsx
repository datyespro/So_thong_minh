import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { createClient } from "@/src/lib/supabase/server";
import { CustomersTable } from "./customers-table";
import type { CustomerRow } from "./customer-list-utils";

export default async function CustomersPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,debt_total")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Không tải được danh sách khách hàng.");
  }

  const customers = (data ?? []) as CustomerRow[];

  return (
    <section className="h-full overflow-y-auto bg-paper px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <CustomersTable initialCustomers={customers} />
      </div>
    </section>
  );
}
