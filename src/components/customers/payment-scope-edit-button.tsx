"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentScopeModal } from "@/src/components/chat/payment-scope-modal";
import { Button } from "@/src/components/ui/button";

// DC-4c: nút "Đổi nhóm" cho cọc trên trang khách. TÁI DÙNG PaymentScopeModal +
// updatePaymentScope (DC-4b) nguyên trạng. Trang khách không có chat message →
// KHÔNG truyền messageId (nhánh cập nhật chat_messages.metadata tự bỏ qua).
// Đổi xong → router.refresh() để server component nạp lại payments + breakdown + số nợ.
export function PaymentScopeEditButton({
  paymentId,
  currentScopeLabel,
}: Readonly<{
  paymentId: string;
  currentScopeLabel: string | null;
}>) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded border-ledgerBorder bg-surface px-4 text-[15px] font-semibold text-textMute hover:bg-paperWarm hover:text-ink"
        onClick={() => setOpen(true)}
      >
        Đổi nhóm
      </Button>
      <PaymentScopeModal
        open={open}
        paymentId={paymentId}
        currentScopeLabel={currentScopeLabel}
        onClose={() => setOpen(false)}
        onScopeChanged={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
