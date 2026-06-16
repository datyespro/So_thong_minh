"use server";

import { getAuthenticatedUser } from "@/src/components/shared/AuthGuard";
import { createClient } from "@/src/lib/supabase/server";

export type SaveShopSettingsInput = {
  shop_name: string;
  phone: string;
  address: string;
};

export type SaveShopSettingsResult = {
  ok: boolean;
  message: string;
};

export async function saveShopSettings(
  formData: SaveShopSettingsInput,
): Promise<SaveShopSettingsResult> {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  const { error } = await supabase.from("shop_settings").upsert(
    {
      owner_id: user.id,
      shop_name: formData.shop_name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );

  if (error) {
    return { ok: false, message: "Lưu thất bại, thử lại sau ạ." };
  }

  return { ok: true, message: "Đã lưu." };
}
