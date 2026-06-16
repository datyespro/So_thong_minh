import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { ShopSettingsForm } from "@/src/components/settings/shop-settings-form";
import { createClient } from "@/src/lib/supabase/server";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("shop_settings")
    .select("shop_name, phone, address")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold text-inkDeep">
        Cài đặt cửa hàng
      </h1>
      <p className="mt-2 text-textMute">
        Thông tin hiển thị trên hóa đơn khi in.
      </p>
      <ShopSettingsForm
        initialData={{
          shop_name: data?.shop_name ?? "",
          phone: data?.phone ?? "",
          address: data?.address ?? "",
        }}
      />
    </div>
  );
}
