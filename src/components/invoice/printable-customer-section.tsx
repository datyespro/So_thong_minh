"use client";

import { Download, Printer } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { exportElementToPdf } from "@/src/lib/invoice/export-pdf";

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
  exportOrderPdf: (orderId: string) => void;
  exportSummaryPdf: (filename?: string) => Promise<void>;
  isExportingPdf: boolean;
};

const PrintOrderContext = createContext<PrintOrderContextValue | null>(null);

type PendingSingleInvoiceAction = Readonly<{
  mode: "print" | "pdf";
  orderId: string;
}>;

function sanitizePdfFilename(filename: string) {
  const cleaned = filename
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned.endsWith(".pdf")
    ? cleaned || "hoa-don.pdf"
    : `${cleaned || "hoa-don"}.pdf`;
}

function filenamePart(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "khach-hang"
  );
}

function pdfDate() {
  return dayjs().tz(APP_TIME_ZONE).format("DD-MM-YYYY");
}

function orderDatePart(order: GroupedOrder) {
  if (!order.business_date) {
    return pdfDate();
  }

  const parsed = dayjs(order.business_date);

  return parsed.isValid() ? parsed.format("DD-MM-YYYY") : pdfDate();
}

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
  const [pendingSingleAction, setPendingSingleAction] =
    useState<PendingSingleInvoiceAction | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const printDate = dayjs().tz(APP_TIME_ZONE).format("DD/MM/YYYY");
  const selectedOrder = printOrderId
    ? groupedOrders.find((order) => order.order_id === printOrderId) ?? null
    : null;

  const printOrder = useCallback((orderId: string) => {
    setPendingSingleAction({ mode: "print", orderId });
    setPrintOrderId(orderId);
  }, []);

  const exportVisibleInvoice = useCallback(
    async (selector: string, filename: string) => {
      const printArea = printAreaRef.current;

      if (!printArea) {
        return;
      }

      const previousStyle = {
        background: printArea.style.background,
        display: printArea.style.display,
        left: printArea.style.left,
        position: printArea.style.position,
        top: printArea.style.top,
        width: printArea.style.width,
      };

      printArea.style.background = "#ffffff";
      printArea.style.display = "block";
      printArea.style.left = "-9999px";
      printArea.style.position = "fixed";
      printArea.style.top = "0";
      printArea.style.width = "210mm";

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      try {
        const element = printArea.querySelector(selector);

        if (!(element instanceof HTMLElement)) {
          throw new Error(`Cannot find invoice element: ${selector}`);
        }

        await exportElementToPdf(element, sanitizePdfFilename(filename));
      } finally {
        printArea.style.background = previousStyle.background;
        printArea.style.display = previousStyle.display;
        printArea.style.left = previousStyle.left;
        printArea.style.position = previousStyle.position;
        printArea.style.top = previousStyle.top;
        printArea.style.width = previousStyle.width;
      }
    },
    [],
  );

  const exportSummaryPdf = useCallback(
    async (filename?: string) => {
      setIsExportingPdf(true);

      try {
        await exportVisibleInvoice(
          ".invoice-summary-view",
          filename ?? `cong-no-${filenamePart(customerName)}-${pdfDate()}.pdf`,
        );
      } catch (error) {
        console.error("Failed to export summary invoice PDF", error);
        window.alert("Không xuất được PDF, thử lại sau ạ.");
      } finally {
        setIsExportingPdf(false);
      }
    },
    [customerName, exportVisibleInvoice],
  );

  const exportOrderPdf = useCallback((orderId: string) => {
    setPendingSingleAction({ mode: "pdf", orderId });
    setPrintOrderId(orderId);
  }, []);

  const contextValue = useMemo(
    () => ({
      exportOrderPdf,
      exportSummaryPdf,
      isExportingPdf,
      printOrder,
    }),
    [exportOrderPdf, exportSummaryPdf, isExportingPdf, printOrder],
  );

  useEffect(() => {
    if (
      !pendingSingleAction ||
      pendingSingleAction.orderId !== printOrderId ||
      !selectedOrder
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (pendingSingleAction.mode === "print") {
        window.print();
        setPrintOrderId(null);
        setPendingSingleAction(null);

        return;
      }

      void (async () => {
        setIsExportingPdf(true);

        try {
          await exportVisibleInvoice(
            ".invoice-single-view",
            `hoa-don-${filenamePart(customerName)}-${orderDatePart(selectedOrder)}-${selectedOrder.order_id.slice(0, 8)}.pdf`,
          );
        } catch (error) {
          console.error("Failed to export single invoice PDF", error);
          window.alert("Không xuất được PDF, thử lại sau ạ.");
        } finally {
          setIsExportingPdf(false);
          setPrintOrderId(null);
          setPendingSingleAction(null);
        }
      })();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    customerName,
    exportVisibleInvoice,
    pendingSingleAction,
    printOrderId,
    selectedOrder,
  ]);

  return (
    <PrintOrderContext.Provider value={contextValue}>
      {children}

      <div ref={printAreaRef} className="print-area print-only">
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

export function PdfExportButton({
  filename,
  label = "Tải PDF",
}: Readonly<{
  filename?: string;
  label?: string;
}>) {
  const context = useContext(PrintOrderContext);

  return (
    <Button
      type="button"
      onClick={() => {
        void context?.exportSummaryPdf(filename);
      }}
      className="no-print h-11 rounded border border-ledgerBorder bg-surface px-4 text-[16px] font-semibold text-ink hover:bg-paperWarm"
      disabled={!context || context.isExportingPdf}
      title="Tải PDF tổng hợp"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {context?.isExportingPdf ? "Đang tạo PDF" : label}
    </Button>
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

export function PdfSingleOrderButton({
  orderId,
  label = "PDF",
}: Readonly<{
  orderId: string;
  label?: string;
}>) {
  const context = useContext(PrintOrderContext);

  return (
    <Button
      type="button"
      onClick={() => context?.exportOrderPdf(orderId)}
      className="no-print h-8 rounded border border-ledgerBorder bg-surface px-2 text-xs font-semibold text-ink hover:bg-paperWarm"
      disabled={!context || context.isExportingPdf}
      title="Tải PDF đơn này"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Button>
  );
}
