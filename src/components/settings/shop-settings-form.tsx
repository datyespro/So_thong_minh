"use client";

import { Save, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { saveShopSettings } from "@/app/(app)/settings/actions";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

type ShopSettingsFormData = {
  shop_name: string;
  phone: string;
  address: string;
};

type ShopSettingsFormProps = Readonly<{
  initialData: ShopSettingsFormData;
}>;

export function ShopSettingsForm({ initialData }: ShopSettingsFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsError(false);

    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await saveShopSettings({
        shop_name: String(formData.get("shop_name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
      });

      setMessage(result.message);
      setIsError(!result.ok);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <form
      className="mt-8 border border-ledgerBorder bg-surface px-4 py-5 shadow-sm sm:px-6"
      onSubmit={handleSubmit}
    >
      <div className="mb-5 flex items-center gap-3 border-b border-dashed border-ledgerBorder pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-paper">
          <Store className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-textMain">Thông tin cửa hàng</p>
          <p className="text-sm text-textMute">Dùng làm header khi in hóa đơn.</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <Label
            htmlFor="shop_name"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-textMute"
          >
            Tên cửa hàng
          </Label>
          <Input
            id="shop_name"
            name="shop_name"
            type="text"
            defaultValue={initialData.shop_name}
            autoComplete="organization"
            className="h-11 rounded-none border-0 border-b border-ledgerBorder bg-transparent px-0 text-base text-textMain shadow-none placeholder:text-textFaint focus-visible:border-ink focus-visible:ring-0"
          />
        </div>

        <div>
          <Label
            htmlFor="phone"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-textMute"
          >
            Số điện thoại
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initialData.phone}
            autoComplete="tel"
            className="h-11 rounded-none border-0 border-b border-ledgerBorder bg-transparent px-0 text-base text-textMain shadow-none placeholder:text-textFaint focus-visible:border-ink focus-visible:ring-0"
          />
        </div>

        <div>
          <Label
            htmlFor="address"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-textMute"
          >
            Địa chỉ
          </Label>
          <Input
            id="address"
            name="address"
            type="text"
            defaultValue={initialData.address}
            autoComplete="street-address"
            className="h-11 rounded-none border-0 border-b border-ledgerBorder bg-transparent px-0 text-base text-textMain shadow-none placeholder:text-textFaint focus-visible:border-ink focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={[
            "min-h-5 text-sm font-medium",
            isError ? "text-debt" : "text-credit",
          ].join(" ")}
          aria-live="polite"
        >
          {message}
        </p>
        <Button
          type="submit"
          className="h-11 rounded border border-inkDeep bg-ink px-5 text-sm font-semibold text-paper shadow-[0_1px_0_var(--ink-deep),0_6px_16px_-6px_rgba(30,58,138,0.4)] hover:bg-inkDeep active:translate-y-px active:shadow-[var(--shadow-press)]"
          disabled={isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isPending ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>
    </form>
  );
}
