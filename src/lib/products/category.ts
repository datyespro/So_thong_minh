export const CATEGORY_NAME_MAX_LENGTH = 60;

export type CategoryView = {
  id: string;
  name: string;
};

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
