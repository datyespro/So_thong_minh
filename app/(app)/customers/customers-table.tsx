"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { updateCustomer, updateCustomerPhone } from "@/app/(app)/chat/actions";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { DebtValue } from "@/src/components/customers/debt-display";
import { CustomerCreateForm } from "./customer-create-form";
import { CustomerDeleteModal } from "./customer-delete-modal";
import {
  applyUpdatedCustomer,
  formatCustomerPhone,
  removeCustomerById,
  type CustomerRow,
} from "./customer-list-utils";

// Bài học TIP-UI-ALIGN-1: header & mỗi dòng là grid ĐỘC LẬP → track cuối phải
// minmax(192px,…) KHÔNG auto, nếu không nhãn cột không thẳng dữ liệu.
const CUSTOMER_GRID_COLUMNS =
  "sm:grid-cols-[minmax(0,1.6fr)_0.9fr_0.9fr_minmax(192px,0.9fr)]";

type DraftState = {
  name: string;
  phone: string;
};

function customerDetailHref(customerId: string) {
  return `/customers/${customerId}`;
}

function CustomerField({
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

export function CustomersTable({
  initialCustomers,
}: Readonly<{ initialCustomers: CustomerRow[] }>) {
  const router = useRouter();
  const [customers, setCustomers] = React.useState(initialCustomers);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftState>({ name: "", phone: "" });
  const [errorByCustomer, setErrorByCustomer] = React.useState<
    Record<string, string>
  >({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [deletingCustomer, setDeletingCustomer] =
    React.useState<CustomerRow | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  function clearError(customerId: string) {
    setErrorByCustomer((current) => {
      const next = { ...current };
      delete next[customerId];
      return next;
    });
  }

  function handleStartEdit(customer: CustomerRow) {
    setEditingId(customer.id);
    setDraft({ name: customer.name, phone: customer.phone ?? "" });
    clearError(customer.id);
  }

  function handleCancelEdit(customerId: string) {
    setEditingId(null);
    setDraft({ name: "", phone: "" });
    clearError(customerId);
  }

  async function handleSave(customer: CustomerRow) {
    const customerId = customer.id;
    const nextName = draft.name.trim();
    const nextPhone = draft.phone.trim();
    const oldPhone = (customer.phone ?? "").trim();

    if (nextName.length === 0) {
      setErrorByCustomer((current) => ({
        ...current,
        [customerId]: "Tên khách không được để trống.",
      }));
      return;
    }

    setSavingId(customerId);
    clearError(customerId);

    try {
      let resolvedName = customer.name;
      let resolvedPhone = customer.phone;

      if (nextName !== customer.name) {
        const result = await updateCustomer(customerId, { name: nextName });
        if (!result.ok) {
          setErrorByCustomer((current) => ({
            ...current,
            [customerId]: result.message,
          }));
          return;
        }
        resolvedName = result.data.name;
      }

      // updateCustomerPhone từ chối SĐT rỗng → chỉ gọi khi có giá trị mới khác cũ.
      if (nextPhone !== oldPhone && nextPhone.length > 0) {
        const result = await updateCustomerPhone(customerId, nextPhone);
        if (!result.ok) {
          setErrorByCustomer((current) => ({
            ...current,
            [customerId]: result.message,
          }));
          return;
        }
        resolvedPhone = result.data.phone;
      }

      setCustomers((current) =>
        applyUpdatedCustomer(current, {
          id: customerId,
          name: resolvedName,
          phone: resolvedPhone,
        }),
      );
      setEditingId(null);
      setDraft({ name: "", phone: "" });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("update customer failed", error);
      setErrorByCustomer((current) => ({
        ...current,
        [customerId]: "Chưa sửa được khách, bác thử lại ạ.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 border-b border-ledgerBorder pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
              KHÁCH HÀNG
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal text-inkDeep">
              Danh sách khách hàng
            </h1>
            <p className="mt-2 text-[16px] leading-7 text-textMute">
              Bấm vào một khách để xem số nợ và lịch sử mua.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {customers.length > 0 ? (
              <p className="font-mono text-[12px] font-semibold text-textMute">
                {customers.length} khách
              </p>
            ) : null}
            <Button
              type="button"
              className="h-11 rounded bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-inkDeep"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Thêm khách
            </Button>
          </div>
        </div>
      </div>

      <CustomerCreateForm
        customers={customers}
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
      />
      <CustomerDeleteModal
        customer={deletingCustomer}
        isOpen={deletingCustomer !== null}
        onClose={() => setDeletingCustomer(null)}
        onDeleted={(id) => setCustomers(removeCustomerById(customers, id))}
      />

      {customers.length === 0 ? (
        <div className="rounded border border-dashed border-borderStrong bg-surface px-6 py-12 text-center">
          <p className="font-display text-[22px] font-semibold text-inkDeep">
            Chưa có khách hàng nào.
          </p>
          <p className="mt-2 text-[15px] text-textMute">
            Thêm khách đầu tiên, hoặc khách sẽ tự xuất hiện khi bác ghi đơn bán.
          </p>
          <Button
            type="button"
            className="mx-auto mt-4 h-11 rounded bg-ink px-4 text-[15px] font-semibold text-paper hover:bg-inkDeep"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Thêm khách
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-ledgerBorder bg-surface">
          <div
            className={cn(
              "hidden gap-2 bg-paperWarm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp sm:grid",
              CUSTOMER_GRID_COLUMNS,
            )}
          >
            <span>Tên</span>
            <span>Số nợ</span>
            <span>Điện thoại</span>
            <span className="text-right">Thao tác</span>
          </div>
          <div className="divide-y divide-ledgerBorder">
            {customers.map((customer) => {
              const isEditing = editingId === customer.id;
              const isSaving = savingId === customer.id;
              const error = errorByCustomer[customer.id] ?? null;

              return (
                <div
                  key={customer.id}
                  className={cn(
                    "block px-3 py-3 text-[16px] leading-7 sm:grid sm:items-start sm:gap-2",
                    CUSTOMER_GRID_COLUMNS,
                  )}
                >
                  <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2 sm:block">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-stamp sm:hidden">
                      Tên
                    </p>
                    {isEditing ? (
                      <label>
                        <span className="sr-only">Sửa tên {customer.name}</span>
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
                      <Link
                        href={customerDetailHref(customer.id)}
                        className="truncate font-semibold text-inkDeep underline-offset-4 hover:underline"
                      >
                        {customer.name}
                      </Link>
                    )}
                  </div>
                  <CustomerField label="Số nợ">
                    <DebtValue value={customer.debt_total} />
                  </CustomerField>
                  <CustomerField label="Điện thoại">
                    {isEditing ? (
                      <label>
                        <span className="sr-only">
                          Sửa số điện thoại {customer.name}
                        </span>
                        <input
                          type="tel"
                          inputMode="tel"
                          value={draft.phone}
                          disabled={isSaving}
                          placeholder="Có thể bỏ trống"
                          className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain outline-none placeholder:text-textFaint focus:border-ink disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : (
                      <p className="break-words font-semibold text-textMute">
                        {formatCustomerPhone(customer.phone)}
                      </p>
                    )}
                  </CustomerField>
                  <CustomerField label="Thao tác">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            disabled={isSaving}
                            className="h-10 w-full rounded bg-ink px-3 text-[15px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                            onClick={() => void handleSave(customer)}
                          >
                            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                            {isSaving ? "Đang lưu..." : "Lưu"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isSaving}
                            className="h-10 w-full rounded border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
                            onClick={() => handleCancelEdit(customer.id)}
                          >
                            <X className="mr-2 h-4 w-4" aria-hidden="true" />
                            Hủy
                          </Button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={customerDetailHref(customer.id)}
                            aria-label={`Xem chi tiết ${customer.name}`}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink sm:w-auto"
                          >
                            Xem
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <Button
                            type="button"
                            variant="outline"
                            title={`Sửa ${customer.name}`}
                            aria-label={`Sửa ${customer.name}`}
                            className="h-10 w-full rounded border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink sm:w-auto"
                            onClick={() => handleStartEdit(customer)}
                          >
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Sửa
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            title={`Xóa ${customer.name}`}
                            aria-label={`Xóa ${customer.name}`}
                            className="h-10 w-full rounded border-ledgerBorder bg-surface px-3 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-debt sm:w-auto"
                            onClick={() => setDeletingCustomer(customer)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            Xóa
                          </Button>
                        </>
                      )}
                    </div>
                  </CustomerField>
                  {isEditing && error ? (
                    <p
                      className="mt-2 text-[15px] leading-6 text-debt sm:col-span-4"
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
    </div>
  );
}
