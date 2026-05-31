import type { ResolvedEntity } from "@/src/lib/ai/resolve-schema";
import type {
  ValidatedIntent,
  ValidatedLineItem,
  ValidationIssue,
} from "@/src/lib/ai/validate-schema";

export const resolvedCustomer: ResolvedEntity = {
  raw: "anh Hùng",
  entity_type: "customer",
  status: "resolved",
  resolved_id: "customer-hung",
  resolved_name: "anh Hùng",
  confidence: 1,
  candidates: [],
};

export const missingCustomer: ResolvedEntity = {
  raw: null,
  entity_type: "customer",
  status: "not_found",
  resolved_id: null,
  resolved_name: null,
  confidence: 0,
  candidates: [],
};

export const notFoundCustomer: ResolvedEntity = {
  raw: "anh Phát",
  entity_type: "customer",
  status: "not_found",
  resolved_id: null,
  resolved_name: null,
  confidence: 0,
  candidates: [],
};

export const needsConfirmationCustomer: ResolvedEntity = {
  raw: "Lan",
  entity_type: "customer",
  status: "needs_confirmation",
  resolved_id: null,
  resolved_name: null,
  confidence: 0.72,
  candidates: [
    {
      id: "customer-lan",
      name: "chị Lan",
      score: 0.72,
      matched_on: "fuzzy",
      matched_value: "chị Lan",
    },
  ],
};

export const resolvedSupplier: ResolvedEntity = {
  raw: "ncc A",
  entity_type: "supplier",
  status: "resolved",
  resolved_id: "supplier-a",
  resolved_name: "Nhà cung cấp A",
  confidence: 1,
  candidates: [],
};

export function item(
  overrides: Partial<ValidatedLineItem> = {},
): ValidatedLineItem {
  return {
    raw: "20 bao xi măng",
    product_name: "xi măng",
    quantity: 20,
    unit: "bao",
    unit_price: 80000,
    confidence: 0.9,
    resolution: {
      raw: "xi măng",
      entity_type: "product",
      status: "resolved",
      resolved_id: "product-xi-mang",
      resolved_name: "xi măng",
      confidence: 1,
      candidates: [],
    },
    effective_quantity: 20,
    effective_unit: "bao",
    effective_unit_price: 80000,
    line_total: 1600000,
    issues: [],
    ...overrides,
  };
}

export function missingPriceIssue(index = 0): ValidationIssue {
  return {
    code: "missing_price",
    severity: "blocking",
    message: 'Hàng "xi măng" chưa có giá. Bác cho biết giá bán ạ?',
    field_path: `items[${index}].unit_price`,
    item_index: index,
  };
}

export function missingCustomerIssue(): ValidationIssue {
  return {
    code: "missing_customer",
    severity: "blocking",
    message: "Chưa rõ bán cho khách nào. Bác cho biết tên khách ạ?",
    field_path: "customer",
    item_index: null,
  };
}

export function warningIssue(): ValidationIssue {
  return {
    code: "payment_status_unknown",
    severity: "warning",
    message: "Chưa rõ trả tiền hay ghi nợ; tạm để xác nhận sau.",
    field_path: "payment_status",
    item_index: null,
  };
}

export function priceAutofilledIssue(index = 0): ValidationIssue {
  return {
    code: "price_autofilled",
    severity: "warning",
    message: 'Dùng giá niêm yết 350000đ cho "cát".',
    field_path: `items[${index}].unit_price`,
    item_index: index,
  };
}

export function customerUnresolvedIssue(): ValidationIssue {
  return {
    code: "customer_unresolved",
    severity: "blocking",
    message: 'Có vài khách gần giống "Lan", cần chọn đúng người.',
    field_path: "customer",
    item_index: null,
  };
}

export function productUnresolvedIssue(index = 0): ValidationIssue {
  return {
    code: "product_unresolved",
    severity: "blocking",
    message: 'Không tìm thấy hàng "đinh".',
    field_path: `items[${index}].product_name`,
    item_index: index,
  };
}

export function baseValidated(
  overrides: Partial<ValidatedIntent> = {},
): ValidatedIntent {
  return {
    intent: "create_order",
    kind: "writable",
    raw_text: "anh Hùng mua 20 bao xi măng",
    customer: resolvedCustomer,
    supplier: null,
    items: [item()],
    effective_amount: 1600000,
    issues: [],
    ready_for_preview: true,
    blocking_count: 0,
    warning_count: 0,
    ...overrides,
  };
}
