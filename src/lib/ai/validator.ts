import { normalizeVi } from "@/src/lib/ai/normalize";
import { formatUnitDisplay } from "@/src/lib/format/unit";
import type { IntentName } from "@/src/lib/ai/intent-schema";
import type {
  ResolvedEntity,
  ResolvedIntent,
  ResolvedItem,
} from "@/src/lib/ai/resolve-schema";
import type {
  ValidatedIntent,
  ValidatedLineItem,
  ValidationIssue,
  ValidationKind,
} from "@/src/lib/ai/validate-schema";

export type ProductMasterValue = {
  name: string;
  unit: string;
  sell_price: number | null;
  cost_price: number | null;
};

export type CustomerDebtValue = {
  debt_total: number;
};

export type ProductMaster = Map<string, ProductMasterValue>;
export type CustomerDebt = Map<string, CustomerDebtValue>;

export type ValidationMasters = {
  products: ProductMaster;
  debts: CustomerDebt;
};

type WritableIntent = "create_order" | "record_payment" | "create_purchase";

type ItemPricingContext = {
  amount: number | null;
  itemCount: number;
  paymentStatus: ResolvedIntent["payment_status"];
};

const WRITABLE_INTENTS = new Set<IntentName>([
  "create_order",
  "record_payment",
  "create_purchase",
]);

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function validationKindForIntent(intent: IntentName): ValidationKind {
  if (WRITABLE_INTENTS.has(intent)) {
    return "writable";
  }

  if (
    intent === "query_debt" ||
    intent === "query_inventory" ||
    intent === "query_sales"
  ) {
    return "query";
  }

  if (intent === "edit_order") {
    return "edit";
  }

  if (intent === "undo") {
    return "undo";
  }

  return "none";
}

function issue(input: ValidationIssue): ValidationIssue {
  return input;
}

function validatedLineFromResolved(
  item: ResolvedItem,
  issues: ValidationIssue[] = [],
  effectiveQuantity: number | null = null,
  effectiveUnit: string | null = null,
  effectiveUnitPrice: number | null = null,
): ValidatedLineItem {
  return {
    ...item,
    effective_quantity: effectiveQuantity,
    effective_unit: effectiveUnit,
    effective_unit_price: effectiveUnitPrice,
    line_total:
      effectiveQuantity !== null && effectiveUnitPrice !== null
        ? effectiveQuantity * effectiveUnitPrice
        : null,
    issues,
  };
}

function displayEntityRaw(entity: ResolvedEntity | null) {
  return entity?.raw ?? "";
}

function validateRequiredCustomer(
  customer: ResolvedEntity | null,
): ValidationIssue[] {
  if (!customer || customer.raw === null) {
    return [
      issue({
        code: "missing_customer",
        severity: "blocking",
        message: "Chưa rõ bán cho khách nào. Bác cho biết tên khách ạ?",
        field_path: "customer",
        item_index: null,
      }),
    ];
  }

  if (customer.status === "resolved") {
    return [];
  }

  const raw = displayEntityRaw(customer);

  return [
    issue({
      code: "customer_unresolved",
      severity: "blocking",
      message:
        customer.status === "not_found"
          ? `Không tìm thấy khách "${raw}". Bác kiểm tra lại tên giúp em?`
          : `Có vài khách gần giống "${raw}", cần chọn đúng người.`,
      field_path: "customer",
      item_index: null,
    }),
  ];
}

function validateRequiredSupplier(
  supplier: ResolvedEntity | null,
): ValidationIssue[] {
  if (!supplier || supplier.raw === null) {
    return [
      issue({
        code: "missing_supplier",
        severity: "blocking",
        message: "Chưa rõ nhập hàng từ nhà cung cấp nào ạ.",
        field_path: "supplier",
        item_index: null,
      }),
    ];
  }

  if (supplier.status === "resolved") {
    return [];
  }

  const raw = displayEntityRaw(supplier);

  return [
    issue({
      code: "supplier_unresolved",
      severity: "blocking",
      message:
        supplier.status === "not_found"
          ? `Không tìm thấy nhà cung cấp "${raw}". Bác kiểm tra lại tên giúp em?`
          : `Có vài nhà cung cấp gần giống "${raw}", cần chọn đúng bên.`,
      field_path: "supplier",
      item_index: null,
    }),
  ];
}

function itemDisplayName(item: ResolvedItem, master?: ProductMasterValue) {
  return item.resolution.resolved_name ?? master?.name ?? item.product_name ?? item.raw;
}

function validateItem(
  item: ResolvedItem,
  itemIndex: number,
  masters: ValidationMasters,
  intent: "create_order" | "create_purchase",
  pricing: ItemPricingContext,
): ValidatedLineItem {
  const itemIssues: ValidationIssue[] = [];
  const productId =
    item.resolution.status === "resolved" ? item.resolution.resolved_id : null;
  const master = productId ? masters.products.get(productId) : undefined;
  const name = itemDisplayName(item, master);

  if (item.resolution.status !== "resolved") {
    const raw = item.resolution.raw ?? item.product_name ?? item.raw;

    itemIssues.push(
      issue({
        code: "product_unresolved",
        severity: "blocking",
        message:
          item.resolution.status === "not_found"
            ? `Không tìm thấy hàng "${raw}".`
            : `Có vài mặt hàng gần giống "${raw}", cần chọn đúng hàng.`,
        field_path: `items[${itemIndex}].product_name`,
        item_index: itemIndex,
      }),
    );
  }

  let effectiveQuantity = item.quantity;

  if (
    effectiveQuantity === null &&
    pricing.amount !== null &&
    pricing.amount > 0 &&
    pricing.itemCount === 1
  ) {
    // Dịch vụ/thỏa thuận: chỉ có tổng tiền, không SL → coi 1 lần = 1 đơn vị
    effectiveQuantity = 1;
  } else if (effectiveQuantity === null || effectiveQuantity <= 0) {
    itemIssues.push(
      issue({
        code: "invalid_quantity",
        severity: "blocking",
        message: `Số lượng của "${name}" chưa hợp lệ ạ.`,
        field_path: `items[${itemIndex}].quantity`,
        item_index: itemIndex,
      }),
    );
  }

  let effectiveUnitPrice = item.unit_price;

  if (effectiveUnitPrice === null) {
    const totalPricing =
      pricing.amount !== null &&
      pricing.amount > 0 &&
      pricing.itemCount === 1 &&
      effectiveQuantity !== null &&
      effectiveQuantity > 0 &&
      pricing.paymentStatus !== "paid" &&
      pricing.paymentStatus !== "partial"
        ? {
            amount: pricing.amount,
            quantity: effectiveQuantity,
            unitPrice: pricing.amount / effectiveQuantity,
          }
      : null;
    const displayUnit = formatUnitDisplay(item.unit);
    const unitWord = displayUnit === "—" ? "đơn vị" : displayUnit;

    if (totalPricing !== null && Number.isInteger(totalPricing.unitPrice)) {
      effectiveUnitPrice = totalPricing.unitPrice;
      itemIssues.push(
        issue({
          code: "price_from_total",
          severity: "warning",
          message: `Tính đơn giá ${formatMoney(totalPricing.unitPrice)}đ từ tổng ${formatMoney(
            totalPricing.amount,
          )}đ cho ${formatMoney(totalPricing.quantity)} ${unitWord}.`,
          field_path: `items[${itemIndex}].unit_price`,
          item_index: itemIndex,
        }),
      );
    } else if (totalPricing !== null) {
      itemIssues.push(
        issue({
          code: "total_not_divisible",
          severity: "blocking",
          message: `Tổng ${formatMoney(totalPricing.amount)}đ không chia đều cho ${formatMoney(
            totalPricing.quantity,
          )} ${unitWord} — bác cho giá từng ${unitWord} ạ?`,
          field_path: `items[${itemIndex}].unit_price`,
          item_index: itemIndex,
        }),
      );
    } else {
      const masterPrice =
        intent === "create_order" ? master?.sell_price : master?.cost_price;

      if (masterPrice !== undefined && masterPrice !== null) {
        effectiveUnitPrice = masterPrice;
        itemIssues.push(
          issue({
            code: "price_autofilled",
            severity: "warning",
            message:
              intent === "create_order"
                ? `Dùng giá niêm yết ${formatMoney(masterPrice)}đ cho "${name}".`
                : `Dùng giá nhập đã lưu ${formatMoney(masterPrice)}đ cho "${name}".`,
            field_path: `items[${itemIndex}].unit_price`,
            item_index: itemIndex,
          }),
        );
      } else {
        itemIssues.push(
          issue({
            code: "missing_price",
            severity: "blocking",
            message:
              intent === "create_order"
                ? `Hàng "${name}" chưa có giá. Bác cho biết giá bán ạ?`
                : `Hàng "${name}" chưa có giá nhập. Bác cho biết giá nhập ạ?`,
            field_path: `items[${itemIndex}].unit_price`,
            item_index: itemIndex,
          }),
        );
      }
    }
  }

  const effectiveUnit = item.unit ?? master?.unit ?? null;

  if (
    item.unit &&
    master?.unit &&
    normalizeVi(item.unit) !== normalizeVi(master.unit)
  ) {
    itemIssues.push(
      issue({
        code: "unit_mismatch",
        severity: "warning",
        message: `Đơn vị "${item.unit}" khác với "${master.unit}" đã lưu.`,
        field_path: `items[${itemIndex}].unit`,
        item_index: itemIndex,
      }),
    );
  }

  return validatedLineFromResolved(
    item,
    itemIssues,
    effectiveQuantity,
    effectiveUnit,
    effectiveUnitPrice,
  );
}

function validateItems(
  resolved: ResolvedIntent,
  masters: ValidationMasters,
  intent: "create_order" | "create_purchase",
) {
  const issues: ValidationIssue[] = [];
  const pricing: ItemPricingContext = {
    amount: resolved.amount ?? null,
    itemCount: resolved.items.length,
    paymentStatus: resolved.payment_status,
  };

  if (resolved.items.length === 0) {
    issues.push(
      issue({
        code: "no_items",
        severity: "blocking",
        message:
          intent === "create_order"
            ? "Chưa rõ bán hàng gì ạ."
            : "Chưa rõ nhập hàng gì ạ.",
        field_path: "items",
        item_index: null,
      }),
    );
  }

  if (
    pricing.amount !== null &&
    pricing.amount > 0 &&
    pricing.itemCount > 1 &&
    pricing.paymentStatus !== "paid" &&
    pricing.paymentStatus !== "partial"
  ) {
    issues.push(
      issue({
        code: "total_with_multiple_items",
        severity: "warning",
        message:
          "Câu có tổng tiền nhưng nhiều mặt hàng, em chưa chia tự động được ạ.",
        field_path: "amount",
        item_index: null,
      }),
    );
  }

  return {
    issues,
    items: resolved.items.map((item, index) =>
      validateItem(item, index, masters, intent, pricing),
    ),
  };
}

function validateCreateOrder(
  resolved: ResolvedIntent,
  masters: ValidationMasters,
) {
  const issues = validateRequiredCustomer(resolved.customer);
  const itemResult = validateItems(resolved, masters, "create_order");
  issues.push(...itemResult.issues);
  const orderTotal = itemResult.items.every((item) => item.line_total !== null)
    ? itemResult.items.reduce((total, item) => total + (item.line_total ?? 0), 0)
    : null;
  let effectivePaid: number | null = null;

  if (resolved.payment_status === "paid") {
    effectivePaid = orderTotal;
  } else if (resolved.payment_status === "partial") {
    const paidAmount = resolved.paid_amount ?? null;

    if (paidAmount === null) {
      issues.push(
        issue({
          code: "payment_status_unknown",
          severity: "warning",
          message: "Chưa rõ trả trước bao nhiêu ạ.",
          field_path: "paid_amount",
          item_index: null,
        }),
      );
    } else if (orderTotal !== null && paidAmount > orderTotal) {
      issues.push(
        issue({
          code: "paid_exceeds_total",
          severity: "blocking",
          message: "Tiền trả không được vượt tổng đơn ạ.",
          field_path: "paid_amount",
          item_index: null,
        }),
      );
    } else if (orderTotal !== null && paidAmount >= 0) {
      effectivePaid = paidAmount;
    }
  } else if (resolved.payment_status === "debt") {
    effectivePaid = 0;
  } else {
    issues.push(
      issue({
        code: "payment_status_unknown",
        severity: "warning",
        message: "Chưa rõ trả tiền hay ghi nợ; tạm để xác nhận sau.",
        field_path: "payment_status",
        item_index: null,
      }),
    );
  }

  return {
    issues,
    items: itemResult.items,
    effectiveAmount: null,
    effectivePaid,
  };
}

function validateRecordPayment(
  resolved: ResolvedIntent,
  masters: ValidationMasters,
) {
  const issues = validateRequiredCustomer(resolved.customer);
  const amount = resolved.amount ?? null;

  if (amount === null) {
    issues.push(
      issue({
        code: "missing_amount",
        severity: "blocking",
        message: "Chưa rõ số tiền trả ạ.",
        field_path: "amount",
        item_index: null,
      }),
    );
  } else if (amount <= 0) {
    issues.push(
      issue({
        code: "invalid_amount",
        severity: "blocking",
        message: "Số tiền chưa hợp lệ.",
        field_path: "amount",
        item_index: null,
      }),
    );
  }

  if (
    amount !== null &&
    amount > 0 &&
    resolved.customer?.status === "resolved" &&
    resolved.customer.resolved_id
  ) {
    const debt = masters.debts.get(resolved.customer.resolved_id);

    if (debt && amount > debt.debt_total) {
      issues.push(
        issue({
          code: "overpayment",
          severity: "warning",
          message: `Số tiền ${formatMoney(amount)}đ lớn hơn công nợ hiện tại (${formatMoney(
            debt.debt_total,
          )}đ). Bác kiểm tra lại?`,
          field_path: "amount",
          item_index: null,
        }),
      );
    }
  }

  if (!resolved.payment_method || normalizeVi(resolved.payment_method) === "unknown") {
    issues.push(
      issue({
        code: "payment_method_unknown",
        severity: "warning",
        message: "Chưa rõ tiền mặt hay chuyển khoản.",
        field_path: "payment_method",
        item_index: null,
      }),
    );
  }

  return {
    issues,
    items: [],
    effectiveAmount: amount,
    effectivePaid: null,
  };
}

function validateCreatePurchase(
  resolved: ResolvedIntent,
  masters: ValidationMasters,
) {
  const issues = validateRequiredSupplier(resolved.supplier);
  const itemResult = validateItems(resolved, masters, "create_purchase");
  issues.push(...itemResult.issues);

  return {
    issues,
    items: itemResult.items,
    effectiveAmount: null,
    effectivePaid: null,
  };
}

function countIssues(
  intentIssues: ValidationIssue[],
  items: ValidatedLineItem[],
  severity: "blocking" | "warning",
) {
  return (
    intentIssues.filter((item) => item.severity === severity).length +
    items.reduce(
      (count, item) =>
        count + item.issues.filter((issueItem) => issueItem.severity === severity).length,
      0,
    )
  );
}

function passthroughItems(items: ResolvedItem[]): ValidatedLineItem[] {
  return items.map((item) => validatedLineFromResolved(item));
}

export function validateResolvedIntent(
  resolved: ResolvedIntent,
  masters: ValidationMasters,
): ValidatedIntent {
  const kind = validationKindForIntent(resolved.intent);

  if (kind !== "writable") {
    return {
      intent: resolved.intent,
      kind,
      raw_text: resolved.raw_text,
      ...(resolved.business_date != null
        ? { business_date: resolved.business_date }
        : {}),
      customer: resolved.customer,
      supplier: resolved.supplier,
      items: passthroughItems(resolved.items),
      effective_amount: null,
      effective_paid: null,
      payment_status: resolved.payment_status ?? null,
      paid_amount: resolved.paid_amount ?? null,
      issues: [],
      ready_for_preview: false,
      blocking_count: 0,
      warning_count: 0,
    };
  }

  let result: {
    issues: ValidationIssue[];
    items: ValidatedLineItem[];
    effectiveAmount: number | null;
    effectivePaid: number | null;
  };

  if (resolved.intent === "create_order") {
    result = validateCreateOrder(resolved, masters);
  } else if (resolved.intent === "record_payment") {
    result = validateRecordPayment(resolved, masters);
  } else {
    result = validateCreatePurchase(resolved, masters);
  }

  const blockingCount = countIssues(result.issues, result.items, "blocking");
  const warningCount = countIssues(result.issues, result.items, "warning");

  return {
    intent: resolved.intent as WritableIntent,
    kind,
    raw_text: resolved.raw_text,
    ...(resolved.business_date != null
      ? { business_date: resolved.business_date }
      : {}),
    customer: resolved.customer,
    supplier: resolved.supplier,
    items: result.items,
    effective_amount: result.effectiveAmount,
    effective_paid: result.effectivePaid ?? null,
    payment_status: resolved.payment_status ?? null,
    paid_amount: resolved.paid_amount ?? null,
    issues: result.issues,
    ready_for_preview: blockingCount === 0,
    blocking_count: blockingCount,
    warning_count: warningCount,
  };
}
