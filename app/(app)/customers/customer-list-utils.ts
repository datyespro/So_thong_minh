import { debtStanding } from "@/src/lib/customers/debt-standing";
import { formatVietnameseMoney } from "@/src/lib/format/money";

// Một dòng khách trên trang danh sách /customers. UI chỉ ĐỌC debt_total để hiển
// thị + cảnh báo xóa; server tự tính số nợ (KHÔNG gửi/sửa).
export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  debt_total: number | string | null;
};

// Ô "Điện thoại": rỗng/null → "—".
export function formatCustomerPhone(value: string | null): string {
  const phone = value?.trim();
  return phone && phone.length > 0 ? phone : "—";
}

// Sau khi xóa mềm: bỏ khách khỏi list tại chỗ.
export function removeCustomerById(
  list: CustomerRow[],
  id: string,
): CustomerRow[] {
  return list.filter((customer) => customer.id !== id);
}

// Sau khi sửa in-row: cập nhật tên + SĐT của đúng 1 khách (giữ debt_total).
export function applyUpdatedCustomer(
  list: CustomerRow[],
  updated: Readonly<{ id: string; name: string; phone: string | null }>,
): CustomerRow[] {
  return list.map((customer) =>
    customer.id === updated.id
      ? { ...customer, name: updated.name, phone: updated.phone }
      : customer,
  );
}

function coerceDebt(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

// Cảnh báo đỏ khi xóa khách còn ràng buộc tiền (mirror product hasStock). Quyết
// định dấu CHỈ qua debtStanding (nguồn duy nhất). VẪN cho xóa — cảnh báo, không chặn.
export function customerDeleteWarning(
  debtTotal: number | string | null,
): { tone: "debt" | "credit"; message: string } | null {
  const standing = debtStanding(coerceDebt(debtTotal));

  if (standing.kind === "debt") {
    return {
      tone: "debt",
      message: `Khách còn nợ ${formatVietnameseMoney(standing.amount)}. Vẫn xóa?`,
    };
  }

  if (standing.kind === "credit") {
    return {
      tone: "credit",
      message: `Khách đang trả trước ${formatVietnameseMoney(standing.amount)}. Vẫn xóa?`,
    };
  }

  return null;
}
