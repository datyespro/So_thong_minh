// DC-5a: gom mua/cọc theo NHÓM hàng cho 1 khách + đối chiếu cộng khớp debt_total.
// THUẦN HIỂN THỊ — chỉ đọc số đã có, KHÔNG ghi/RPC/ledger. Pure-fn (không I/O) để
// test KHÓA phép cộng. page.tsx chỉ fetch + dựng Map + gọi; component chỉ render.
//
// Lý thuyết khép vòng: vì coc_tat_ca = coc_theo_nhom + coc_chung, nên
//   Σ(mua_nhom − coc_nhom) − coc_chung − tra_ngay = mua_theo_dong − coc_tat_ca − tra_ngay
// = debt_total KHI VÀ CHỈ KHI denorm đúng + mua_theo_dong == mua_theo_don. Vì vậy
// một phép so `remainder === debtTotal` đã khóa luôn cả hai điều kiện (lệch → reconciles=false).

type MoneyInput = number | string | null | undefined;

// Hàng mua chưa gắn nhóm / mồ côi (product/category đã xóa). KHÔNG nhận cọc.
export const UNCLASSIFIED_LABEL = "Chưa phân loại";

export type CategoryBreakdownItem = {
  line_total: MoneyInput;
  product_id: string | null;
};

export type CategoryBreakdownPayment = {
  amount: MoneyInput;
  scope_category_id: string | null;
};

export type CategoryGroup = {
  name: string; // tên danh mục, hoặc UNCLASSIFIED_LABEL
  purchased: number; // Đã mua = Σ line_total của nhóm
  deposited: number; // Đã cọc = Σ payments.amount gắn ĐÚNG nhóm này (danh mục còn sống)
  tentative: number; // Tạm tính = purchased − deposited (có thể ÂM = cọc dư)
};

export type CategoryBreakdown = {
  groups: CategoryGroup[]; // name A→Z; UNCLASSIFIED_LABEL luôn ĐỨNG CUỐI
  generalDeposit: number; // Cọc chung = cọc không scope + cọc scope vào danh mục đã xóa mềm
  paidImmediate: number; // Trả ngay khi mua (truyền vào)
  groupTentativeTotal: number; // Σ tentative
  remainder: number; // groupTentativeTotal − generalDeposit − paidImmediate
  debtTotal: number; // truyền vào (customers.debt_total)
  reconciles: boolean; // round(remainder) === round(debtTotal)
};

function numericMoney(value: MoneyInput): number {
  const numeric = Number(value ?? 0);

  return Number.isFinite(numeric) ? numeric : 0;
}

// Tên nhóm của 1 mặt hàng mua. product_id null / chưa gắn nhóm / danh mục đã xóa
// mềm (không có trong categoryName) → UNCLASSIFIED_LABEL.
// DC-5b: export làm nguồn nhãn dùng chung (page resolve nhãn dòng mua qua hàm này).
export function resolveItemGroupName(
  productId: string | null,
  productCategory: Map<string, string | null>,
  categoryName: Map<string, string>,
): string {
  if (productId == null) {
    return UNCLASSIFIED_LABEL;
  }

  const categoryId = productCategory.get(productId);

  if (categoryId == null) {
    return UNCLASSIFIED_LABEL;
  }

  return categoryName.get(categoryId) ?? UNCLASSIFIED_LABEL;
}

export function buildCategoryBreakdown(
  input: Readonly<{
    items: CategoryBreakdownItem[];
    payments: CategoryBreakdownPayment[];
    productCategory: Map<string, string | null>; // product_id → category_id
    categoryName: Map<string, string>; // category_id → name (CHỈ danh mục còn sống)
    paidImmediate: MoneyInput;
    debtTotal: MoneyInput;
  }>,
): CategoryBreakdown {
  const {
    items,
    payments,
    productCategory,
    categoryName,
    paidImmediate,
    debtTotal,
  } = input;

  // Gom theo tên nhóm (giữ purchased/deposited tách bạch).
  const groupMap = new Map<string, { purchased: number; deposited: number }>();

  const ensureGroup = (name: string) => {
    let group = groupMap.get(name);

    if (!group) {
      group = { purchased: 0, deposited: 0 };
      groupMap.set(name, group);
    }

    return group;
  };

  // Mua → purchased của nhóm tương ứng.
  for (const item of items) {
    const name = resolveItemGroupName(
      item.product_id,
      productCategory,
      categoryName,
    );

    ensureGroup(name).purchased += numericMoney(item.line_total);
  }

  // Cọc: không scope HOẶC scope vào danh mục đã xóa mềm → generalDeposit (Cọc chung).
  // scope vào danh mục còn sống → deposited của nhóm tên đó (KHÔNG vào "Chưa phân loại").
  let generalDeposit = 0;

  for (const payment of payments) {
    const amount = numericMoney(payment.amount);
    const scopeId = payment.scope_category_id;

    if (scopeId == null) {
      generalDeposit += amount;
      continue;
    }

    const name = categoryName.get(scopeId);

    if (name == null) {
      generalDeposit += amount; // orphan (danh mục xóa mềm) → Cọc chung
      continue;
    }

    ensureGroup(name).deposited += amount;
  }

  const groups: CategoryGroup[] = Array.from(groupMap.entries()).map(
    ([name, { purchased, deposited }]) => ({
      name,
      purchased,
      deposited,
      tentative: purchased - deposited,
    }),
  );

  // name A→Z (vi); UNCLASSIFIED_LABEL luôn đẩy xuống cuối bất kể chữ cái.
  groups.sort((left, right) => {
    if (left.name === UNCLASSIFIED_LABEL) {
      return right.name === UNCLASSIFIED_LABEL ? 0 : 1;
    }

    if (right.name === UNCLASSIFIED_LABEL) {
      return -1;
    }

    return left.name.localeCompare(right.name, "vi");
  });

  const groupTentativeTotal = groups.reduce(
    (total, group) => total + group.tentative,
    0,
  );
  const normalizedPaidImmediate = numericMoney(paidImmediate);
  const normalizedDebtTotal = numericMoney(debtTotal);
  const remainder =
    groupTentativeTotal - generalDeposit - normalizedPaidImmediate;

  return {
    groups,
    generalDeposit,
    paidImmediate: normalizedPaidImmediate,
    groupTentativeTotal,
    remainder,
    debtTotal: normalizedDebtTotal,
    // Tiền VN số nguyên đồng — round cả hai vế để khỏi vỡ vì float.
    reconciles: Math.round(remainder) === Math.round(normalizedDebtTotal),
  };
}
