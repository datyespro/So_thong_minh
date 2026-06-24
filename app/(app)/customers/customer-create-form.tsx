"use client";

import * as React from "react";
import { Save, X } from "lucide-react";
import { createCustomer } from "@/app/(app)/chat/actions";
import { Button } from "@/src/components/ui/button";
import type { CustomerRow } from "./customer-list-utils";

// Form Tạo khách (inline box, mirror product-create-form): Tên (bắt buộc) + SĐT
// (tùy chọn). createCustomer trả view chỉ {id,name} → tạo xong RELOAD để SĐT vừa
// nhập hiện ngay trong danh sách.
export function CustomerCreateForm({
  customers,
  isOpen,
  onClose,
}: {
  customers: CustomerRow[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên khách không được để trống.");
      return;
    }
    setError(null);
    setIsSaving(true);

    try {
      const result = await createCustomer(name.trim(), phone.trim() || undefined);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // createCustomer dedup theo tên: trùng → trả khách CŨ (id đã có trong list).
      if (customers.some((customer) => customer.id === result.data.id)) {
        setError("Khách này có rồi ạ.");
        return;
      }

      // View chỉ {id,name}; reload để SĐT vừa nhập hiện ngay.
      window.location.reload();
    } catch (err) {
      console.error("createCustomer failed", err);
      setError("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded border border-ledgerBorder bg-surface p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-inkDeep">
        Thêm khách
      </h2>
      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="customer-name"
            className="mb-1 block text-sm font-medium text-textMain"
          >
            Tên <span className="text-debt">*</span>
          </label>
          <input
            id="customer-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
            placeholder="Ví dụ: anh Tư"
            className="h-10 w-full rounded border border-stamp/35 bg-paper px-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <div>
          <label
            htmlFor="customer-phone"
            className="mb-1 block text-sm font-medium text-textMain"
          >
            Điện thoại
          </label>
          <input
            id="customer-phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSaving}
            placeholder="Có thể bỏ trống"
            className="h-10 w-full rounded border border-stamp/35 bg-paper px-3 text-[16px] text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {error && (
          <div className="sm:col-span-2">
            <p className="text-[15px] leading-6 text-debt" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onClose}
            className="h-10 border-ledgerBorder bg-surface text-textMute hover:bg-paperWarm hover:text-ink"
          >
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 bg-ink text-paper hover:bg-inkDeep"
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
