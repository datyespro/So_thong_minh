export type ProductSellPriceInput = string | number | null | undefined;

export type ProductUpdateInput = Readonly<{
  unit?: string;
  sell_price?: ProductSellPriceInput;
}>;

export type ProductUpdatePayload = Partial<{
  unit: string;
  sell_price: number | null;
}>;

export type ProductUpdateField = keyof ProductUpdatePayload;

export type ValidatedProductUpdate = Readonly<{
  patch: ProductUpdatePayload;
  fields: ProductUpdateField[];
}>;

export type ProductUpdateValidationResult =
  | { ok: true; data: ValidatedProductUpdate }
  | { ok: false; message: string };

function hasOwnField<T extends object>(input: T, field: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

export function parseProductSellPriceInput(
  input: ProductSellPriceInput,
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (input === null || input === undefined) {
    return { ok: true, value: null };
  }

  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      return { ok: false, message: "Giá không hợp lệ" };
    }

    return { ok: true, value: Math.round(input) };
  }

  if (typeof input !== "string") {
    return { ok: false, message: "Giá không hợp lệ" };
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  if (trimmed.includes("-")) {
    return { ok: false, message: "Giá không hợp lệ" };
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    return { ok: false, message: "Giá không hợp lệ" };
  }

  const value = Number(digits);

  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: "Giá không hợp lệ" };
  }

  return { ok: true, value: Math.round(value) };
}

export function validateProductUpdatePatch(
  input: ProductUpdateInput,
): ProductUpdateValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, message: "Thông tin sửa hàng chưa hợp lệ" };
  }

  const patch: ProductUpdatePayload = {};
  const fields: ProductUpdateField[] = [];

  if (hasOwnField(input, "unit")) {
    const unit = typeof input.unit === "string" ? input.unit.trim() : "";

    if (unit.length === 0) {
      return { ok: false, message: "Đơn vị không được để trống" };
    }

    patch.unit = unit;
    fields.push("unit");
  }

  if (hasOwnField(input, "sell_price")) {
    const parsed = parseProductSellPriceInput(input.sell_price);

    if (!parsed.ok) {
      return parsed;
    }

    patch.sell_price = parsed.value;
    fields.push("sell_price");
  }

  if (fields.length === 0) {
    return { ok: false, message: "Chưa có thông tin cần sửa" };
  }

  return {
    ok: true,
    data: {
      patch,
      fields,
    },
  };
}
