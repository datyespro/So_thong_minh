import { createClient } from "@/src/lib/supabase/server";

export type ShopSettings = {
  shop_name: string;
  phone: string;
  address: string;
};

export async function getShopSettings(userId: string): Promise<ShopSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_settings")
    .select("shop_name, phone, address")
    .eq("owner_id", userId)
    .maybeSingle();

  return {
    shop_name: data?.shop_name ?? "",
    phone: data?.phone ?? "",
    address: data?.address ?? "",
  };
}
