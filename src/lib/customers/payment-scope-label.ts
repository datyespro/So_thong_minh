// DC-5d: hậu tố nhóm cho dòng "− Trả {ngày}" trên panel màn + bản in/PDF.
// Cọc có nhãn nhóm → " (tên nhóm)"; không nhãn (Chung/orphan) → "" (không ngoặc).
// Thuần để test trực tiếp; nguồn nhãn là map categoryName resolve sẵn trên page.
export function paymentScopeSuffix(
  scopeLabel: string | null | undefined,
): string {
  return scopeLabel ? ` (${scopeLabel})` : "";
}
