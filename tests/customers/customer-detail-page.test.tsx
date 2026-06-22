import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetailPage from "@/app/(app)/customers/[id]/page";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuthenticatedUser: vi.fn(),
}));

vi.mock("@/src/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/src/components/shared/AuthGuard", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

type CustomerRow = {
  id: string;
  name: string;
  debt_total: number;
  phone: string | null;
};

type OrderRow = {
  id: string;
  business_date: string;
  total_amount: number;
  paid_amount: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
};

type ItemRow = {
  order_id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_snapshot: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
};

type PageData = {
  customer?: CustomerRow;
  orders?: OrderRow[];
  payments?: PaymentRow[];
  items?: ItemRow[];
  shopSettings?: {
    shop_name: string;
    phone: string;
    address: string;
  };
};

function createQueryResult<T>(data: T) {
  return { data, error: null };
}

function createQueryBuilder<T>(result: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(async () => createQueryResult(result)),
    maybeSingle: vi.fn(async () => createQueryResult(result)),
  };

  return query;
}

function setupSupabaseMock({
  customer = {
    id: "customer-1",
    name: "anh Hùng",
    debt_total: 4200000,
    phone: null,
  },
  orders = [
    {
      id: "order-1",
      business_date: "2026-06-01",
      total_amount: 1600000,
      paid_amount: 0,
    },
    {
      id: "order-2",
      business_date: "2026-06-11",
      total_amount: 2800000,
      paid_amount: 0,
    },
  ],
  payments = [
    {
      id: "payment-1",
      amount: 200000,
      paid_at: "2026-05-31T03:00:00.000Z",
    },
  ],
  shopSettings = {
    shop_name: "Cửa hàng Test",
    phone: "0900000000",
    address: "123 Test",
  },
  items = [
    {
      order_id: "order-1",
      product_name_snapshot: "xi măng",
      quantity: 20,
      unit_snapshot: "bao",
      unit_price: 80000,
      line_total: 1600000,
      sort_order: 0,
    },
    {
      order_id: "order-2",
      product_name_snapshot: "thép",
      quantity: 1,
      unit_snapshot: "cây",
      unit_price: 2800000,
      line_total: 2800000,
      sort_order: 0,
    },
  ],
}: PageData = {}) {
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "customers") {
        return createQueryBuilder(customer);
      }

      if (table === "orders") {
        return createQueryBuilder(orders);
      }

      if (table === "payments") {
        return createQueryBuilder(payments);
      }

      if (table === "order_items") {
        return createQueryBuilder(items);
      }

      if (table === "shop_settings") {
        return createQueryBuilder(shopSettings);
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  mocks.createClient.mockResolvedValue(supabase);

  return supabase;
}

async function renderCustomerDetailPage(data: PageData = {}) {
  setupSupabaseMock(data);

  const page = await CustomerDetailPage({
    params: Promise.resolve({ id: "customer-1" }),
    searchParams: Promise.resolve({}),
  });

  return renderToStaticMarkup(page).split('<div class="print-area print-only">')[0];
}

function countText(html: string, text: string) {
  return html.split(text).length - 1;
}

describe("CustomerDetailPage purchase history footer", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.getAuthenticatedUser.mockReset();
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "owner-1" });
  });

  it("shows the settlement block with each payment date when summary reconciles and totals match", async () => {
    const html = await renderCustomerDetailPage();

    expect(countText(html, "− Trả 31/05/2026")).toBe(2);
    expect(countText(html, "= Còn nợ")).toBe(2);
    expect(html).toContain("Tổng mua");
    expect(html).toContain("4.400.000 đ");
    expect(html).toContain("200.000 đ");
    expect(html).toContain("4.200.000 đ");
    expect(html).not.toContain("− Trả 31/05/2026 10");
  });

  it("shows a negative balance as 'Khách trả trước', not a negative 'Còn nợ' (VĐ3)", async () => {
    // Khách trả vượt nợ: tổng mua 4.400.000, trả 81.816.000 → debt_total âm.
    const html = await renderCustomerDetailPage({
      customer: {
        id: "customer-1",
        name: "anh Hùng",
        debt_total: -77416000,
        phone: null,
      },
      payments: [
        {
          id: "payment-overpaid",
          amount: 81816000,
          paid_at: "2026-05-31T03:00:00.000Z",
        },
      ],
    });

    expect(html).toContain("Khách trả trước");
    expect(html).toContain("77.416.000 đ");
    expect(html).toContain("Tổng mua");
    expect(html).toContain("Đã trả");
    expect(html).not.toContain("Còn nợ");
    expect(html).not.toContain("-77");
    expect(html).not.toContain("−77");
  });

  it("shows multiple payment rows in ascending payment-date order", async () => {
    const html = await renderCustomerDetailPage({
      payments: [
        {
          id: "payment-later",
          amount: 100000,
          paid_at: "2026-06-05T03:00:00.000Z",
        },
        {
          id: "payment-earlier",
          amount: 100000,
          paid_at: "2026-06-01T03:00:00.000Z",
        },
      ],
    });

    expect(countText(html, "− Trả 01/06/2026")).toBe(2);
    expect(countText(html, "− Trả 05/06/2026")).toBe(2);
    expect(html.indexOf("− Trả 01/06/2026")).toBeLessThan(
      html.indexOf("− Trả 05/06/2026"),
    );
  });

  it("shows immediate paid amount as a separate settlement row", async () => {
    const html = await renderCustomerDetailPage({
      customer: {
        id: "customer-1",
        name: "anh Hùng",
        debt_total: 3900000,
        phone: null,
      },
      orders: [
        {
          id: "order-1",
          business_date: "2026-06-01",
          total_amount: 1600000,
          paid_amount: 300000,
        },
        {
          id: "order-2",
          business_date: "2026-06-11",
          total_amount: 2800000,
          paid_amount: 0,
        },
      ],
      payments: [
        {
          id: "payment-1",
          amount: 200000,
          paid_at: "2026-06-02T03:00:00.000Z",
        },
      ],
    });

    expect(countText(html, "− Trả 02/06/2026")).toBe(2);
    expect(countText(html, "− Trả ngay khi mua")).toBe(2);
    expect(html).toContain("300.000 đ");
    expect(html).toContain("3.900.000 đ");
  });

  it("keeps the old one-line footer when the customer has not paid anything", async () => {
    const html = await renderCustomerDetailPage({
      customer: {
        id: "customer-1",
        name: "anh Hùng",
        debt_total: 4400000,
        phone: null,
      },
      payments: [],
    });

    expect(html).toContain("Tổng cộng");
    expect(html).not.toContain("− Trả ");
    expect(html).not.toContain("= Còn nợ");
  });

  it("keeps the old one-line footer when debt summary does not reconcile", async () => {
    const html = await renderCustomerDetailPage({
      customer: {
        id: "customer-1",
        name: "anh Hùng",
        debt_total: 4100000,
        phone: null,
      },
    });

    expect(html).toContain("Tổng cộng");
    expect(html).not.toContain("− Trả ");
    expect(html).not.toContain("= Còn nợ");
    expect(html).toContain("Số liệu đang lệch, cần kiểm tra ạ");
  });

  it("keeps the old one-line footer when rendered history total differs from total purchase", async () => {
    const html = await renderCustomerDetailPage({
      items: [
        {
          order_id: "order-1",
          product_name_snapshot: "xi măng",
          quantity: 20,
          unit_snapshot: "bao",
          unit_price: 80000,
          line_total: 1600000,
          sort_order: 0,
        },
        {
          order_id: "order-2",
          product_name_snapshot: "thép",
          quantity: 1,
          unit_snapshot: "cây",
          unit_price: 2700000,
          line_total: 2700000,
          sort_order: 0,
        },
      ],
    });

    expect(html).toContain("Tổng cộng");
    expect(html).toContain("4.300.000 đ");
    expect(html).not.toContain("− Trả ");
    expect(html).not.toContain("= Còn nợ");
  });
});
