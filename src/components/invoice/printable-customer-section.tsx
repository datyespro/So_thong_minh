"use client";

import { Printer } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { InvoiceSingleView } from "@/src/components/invoice/invoice-single-view";
import { InvoiceSummaryView } from "@/src/components/invoice/invoice-summary-view";
import { Button } from "@/src/components/ui/button";
import type { CustomerDebtSummary } from "@/src/lib/customers/debt-summary";
import type { GroupedOrder } from "@/src/lib/customers/group-orders";
import type { CustomerPurchaseHistoryRow } from "@/src/lib/customers/purchase-history";
import { APP_TIME_ZONE, dayjs } from "@/src/lib/dayjs";
import type { ShopSettings } from "@/src/lib/shop/get-shop-settings";

type CustomerPaymentRow = {
  id: string;
  amount: number | string | null;
  paid_at: string | null;
};

type PrintableCustomerSectionProps = Readonly<{
  children: ReactNode;
  shopSettings: ShopSettings;
  customerName: string;
  customerPhone: string | null;
  rows: CustomerPurchaseHistoryRow[];
  historyTotal: number;
  debtSummary: CustomerDebtSummary;
  payments: CustomerPaymentRow[];
  groupedOrders: GroupedOrder[];
}>;

type PrintOrderContextValue = {
  printOrder: (orderId: string) => void;
};

const PrintOrderContext = createContext<PrintOrderContextValue | null>(null);

export function PrintableCustomerSection({
  children,
  shopSettings,
  customerName,
  customerPhone,
  rows,
  historyTotal,
  debtSummary,
  payments,
  groupedOrders,
}: PrintableCustomerSectionProps) {
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const printDate = dayjs().tz(APP_TIME_ZONE).format("DD/MM/YYYY");
  const selectedOrder = printOrderId
    ? groupedOrders.find((order) => order.order_id === printOrderId) ?? null
    : null;

  const printOrder = useCallback((orderId: string) => {
    setPrintOrderId(orderId);
  }, []);

  const contextValue = useMemo(
    () => ({ printOrder }),
    [printOrder],
  );

  useEffect(() => {
    if (!printOrderId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.print();
      setPrintOrderId(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [printOrderId]);

  return (
    <PrintOrderContext.Provider value={contextValue}>
      {children}

      <div className="print-area print-only">
        {selectedOrder ? (
          <InvoiceSingleView
            shopSettings={shopSettings}
            customerName={customerName}
            customerPhone={customerPhone}
            order={selectedOrder}
            printDate={printDate}
          />
        ) : (
          <InvoiceSummaryView
            shopSettings={shopSettings}
            customerName={customerName}
            customerPhone={customerPhone}
            rows={rows}
            historyTotal={historyTotal}
            debtSummary={debtSummary}
            payments={payments}
            printDate={printDate}
          />
        )}
      </div>
    </PrintOrderContext.Provider>
  );
}

export function PrintSingleOrderButton({
  orderId,
  label = "In",
}: Readonly<{
  orderId: string;
  label?: string;
}>) {
  const context = useContext(PrintOrderContext);

  return (
    <Button
      type="button"
      onClick={() => context?.printOrder(orderId)}
      className="no-print h-8 rounded border border-ledgerBorder bg-surface px-2 text-xs font-semibold text-ink hover:bg-paperWarm"
      disabled={!context}
      title="In đơn này"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}
