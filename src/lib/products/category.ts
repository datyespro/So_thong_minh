export const CATEGORY_NAME_MAX_LENGTH = 60;

export type CategoryView = {
  id: string;
  name: string;
};

// Tách từ actions.ts (dùng chung client+server, KHÔNG nhân bản lệch).
// v1: chỉ trim + hạ thường vi (không bỏ dấu, không fuzzy) — "Gạch"=="gạch".
export function normalizeCategoryName(name: string) {
  return name.trim().toLocaleLowerCase("vi-VN");
}

export type PaymentScopeCategoryResolution =
  | { status: "none" }
  | { status: "matched"; categoryId: string }
  | { status: "not_found" }
  | { status: "ambiguous" };

// DC-6c: khớp chuỗi thô payment_scope_raw với danh mục (owner-scoped, đang sống
// — caller lo lọc). Chỉ gợi ý trình bày; server RPC v4 vẫn thẩm định id cuối.
export function resolvePaymentScopeCategory(
  rawName: string | null,
  categories: CategoryView[],
): PaymentScopeCategoryResolution {
  const raw = typeof rawName === "string" ? rawName.trim() : "";
  if (!raw) return { status: "none" };
  const normalized = normalizeCategoryName(raw);
  const matches = categories.filter(
    (category) => normalizeCategoryName(category.name) === normalized,
  );
  if (matches.length === 1) return { status: "matched", categoryId: matches[0].id };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "not_found" };
}

export type CategoryNameValidationResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function validateCategoryName(
  input: unknown,
): CategoryNameValidationResult {
  const name = typeof input === "string" ? input.trim() : "";

  if (name.length === 0) {
    return { ok: false, message: "Tên danh mục không được để trống" };
  }

  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return { ok: false, message: "Tên danh mục quá dài" };
  }

  return { ok: true, value: name };
}
