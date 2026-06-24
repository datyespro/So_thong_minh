"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteCustomer } from "@/app/(app)/chat/actions";
import { Button } from "@/src/components/ui/button";
import { customerDeleteWarning, type CustomerRow } from "./customer-list-utils";

// Modal xóa khách (mirror product-delete-modal): fixed overlay + dialog centered,
// ESC + click-outside (chặn khi đang xóa). Cảnh báo đỏ khi còn nợ / trả trước
// nhưng VẪN cho xóa (Chủ thầu chốt). Lịch sử đơn & trả nợ giữ nguyên (soft-delete).
export function CustomerDeleteModal({
  customer,
  isOpen,
  onClose,
  onDeleted,
}: {
  customer: CustomerRow | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (customerId: string) => void;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsDeleting(false);
    }
  }, [isOpen, customer]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !customer) {
    return null;
  }

  const warning = customerDeleteWarning(customer.debt_total);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteCustomer(customer!.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDeleted(customer!.id);
      onClose();
    } catch (err) {
      console.error("deleteCustomer failed", err);
      setError("Có lỗi xảy ra khi xóa khách, vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-inkDeep/40 transition-opacity"
        aria-hidden="true"
        onClick={() => !isDeleting && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-customer-modal-title"
          className="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8"
        >
          <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-debt/10 sm:mx-0 sm:h-10 sm:w-10">
                <AlertTriangle className="h-6 w-6 text-debt" aria-hidden="true" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3
                  className="font-display text-lg font-semibold leading-6 text-inkDeep"
                  id="delete-customer-modal-title"
                >
                  Xóa khách
                </h3>
                <div className="mt-2 text-textMain">
                  <p>
                    Xóa <strong>{customer.name}</strong>? Lịch sử đơn & trả nợ vẫn được giữ.
                  </p>
                  {warning && (
                    <p className="mt-2 font-medium text-debt">{warning.message}</p>
                  )}
                </div>
                {error && (
                  <div className="mt-4 rounded bg-debt/10 p-3">
                    <p className="text-sm font-medium text-debt" role="alert">
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="bg-paperWarm px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="inline-flex w-full justify-center rounded-md bg-debt px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-debt/90 disabled:opacity-60 sm:ml-3 sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md border border-ledgerBorder bg-surface px-3 py-2 text-sm font-semibold text-textMain shadow-sm hover:bg-paper sm:mt-0 sm:w-auto"
            >
              Hủy
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
