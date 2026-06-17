"use client";

import { Download, FileText, ImageDown, Printer } from "lucide-react";
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
import {
  exportElementToImage,
  exportElementToPdf,
} from "@/src/lib/invoice/export-pdf";

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
  exportOrderImage: (orderId: string) => void;
  exportSummaryPdf: (filename?: string) => Promise<void>;
  exportSummaryImage: (filename?: string) => Promise<void>;
  isExportingPdf: boolean;
  isExportingImage: boolean;
};

const PrintOrderContext = createContext<PrintOrderContextValue | null>(null);

type PendingSingleInvoiceAction = Readonly<{
  mode: "print" | "pdf" | "image";
  orderId: string;
}>;

function sanitizeBaseFilename(filename: string) {
  return filename
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizePdfFilename(filename: string) {
  const cleaned = sanitizeBaseFilename(filename);

  return cleaned.endsWith(".pdf")
    ? cleaned || "hoa-don.pdf"
    : `${cleaned || "hoa-don"}.pdf`;
}

function sanitizeImageFilename(filename: string) {
  const cleaned = sanitizeBaseFilename(filename);

  return cleaned.endsWith(".png")
    ? cleaned || "hoa-don.png"
    : `${cleaned || "hoa-don"}.png`;
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
  const [isExportingImage, setIsExportingImage] = useState(false);
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

  const exportVisibleInvoiceImage = useCallback(
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

        await exportElementToImage(element, sanitizeImageFilename(filename));
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

  const exportSummaryImage = useCallback(
    async (filename?: string) => {
      setIsExportingImage(true);

      try {
        await exportVisibleInvoiceImage(
          ".invoice-summary-view",
          filename ?? `cong-no-${filenamePart(customerName)}-${pdfDate()}.png`,
        );
      } catch (error) {
        console.error("Failed to export summary invoice image", error);
        window.alert("Không xuất được ảnh, thử lại sau ạ.");
      } finally {
        setIsExportingImage(false);
      }
    },
    [customerName, exportVisibleInvoiceImage],
  );

  const exportOrderPdf = useCallback((orderId: string) => {
    setPendingSingleAction({ mode: "pdf", orderId });
    setPrintOrderId(orderId);
  }, []);

  const exportOrderImage = useCallback((orderId: string) => {
    setPendingSingleAction({ mode: "image", orderId });
    setPrintOrderId(orderId);
  }, []);

  const contextValue = useMemo(
    () => ({
      exportOrderImage,
      exportOrderPdf,
      exportSummaryImage,
      exportSummaryPdf,
      isExportingImage,
      isExportingPdf,
      printOrder,
    }),
    [
      exportOrderImage,
      exportOrderPdf,
      exportSummaryImage,
      exportSummaryPdf,
      isExportingImage,
      isExportingPdf,
      printOrder,
    ],
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

      if (pendingSingleAction.mode === "image") {
        void (async () => {
          setIsExportingImage(true);

          try {
            await exportVisibleInvoiceImage(
              ".invoice-single-view",
              `hoa-don-${filenamePart(customerName)}-${orderDatePart(selectedOrder)}-${selectedOrder.order_id.slice(0, 8)}.png`,
            );
          } catch (error) {
            console.error("Failed to export single invoice image", error);
            window.alert("Không xuất được ảnh, thử lại sau ạ.");
          } finally {
            setIsExportingImage(false);
            setPrintOrderId(null);
            setPendingSingleAction(null);
          }
        })();

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
    exportVisibleInvoiceImage,
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

export function InvoiceActionPopover({
  orderId,
  itemCount,
}: Readonly<{
  orderId: string;
  itemCount: number;
}>) {
  const context = useContext(PrintOrderContext);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const title =
    itemCount > 1 ? `In hóa đơn (${itemCount} món)` : "In hóa đơn";

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="no-print relative inline-flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded border border-ledgerBorder bg-surface text-ink shadow-sm hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
        disabled={!context}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{title}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-40 w-40 max-w-[calc(100vw-2rem)] rounded border border-ledgerBorder bg-surface py-1 text-left shadow-[0_16px_40px_-18px_rgba(23,37,84,0.45),0_1px_0_var(--ledger-border)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              context?.printOrder(orderId);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            In hóa đơn
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              context?.exportOrderPdf(orderId);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!context || context.isExportingPdf}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {context?.isExportingPdf ? "Đang tạo PDF" : "Tải PDF"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              context?.exportOrderImage(orderId);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!context || context.isExportingImage}
          >
            <ImageDown className="h-4 w-4" aria-hidden="true" />
            {context?.isExportingImage ? "Đang tạo ảnh" : "Tải ảnh"}
          </button>
        </div>
      ) : null}
    </div>
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

export function SummaryInvoicePopover({
  pdfFilename,
  imageFilename,
}: Readonly<{
  pdfFilename?: string;
  imageFilename?: string;
}>) {
  const context = useContext(PrintOrderContext);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="no-print relative inline-flex">
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 rounded border border-ledgerBorder bg-surface px-4 text-[16px] font-semibold text-ink hover:bg-paperWarm"
        disabled={!context}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        Xuất hóa đơn
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-40 w-48 rounded border border-ledgerBorder bg-surface py-1 text-left shadow-[0_16px_40px_-18px_rgba(23,37,84,0.45),0_1px_0_var(--ledger-border)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            In tổng hợp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void context?.exportSummaryPdf(pdfFilename);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!context || context.isExportingPdf}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {context?.isExportingPdf ? "Đang tạo PDF..." : "Tải PDF"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void context?.exportSummaryImage(imageFilename);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
            disabled={!context || context.isExportingImage}
          >
            <ImageDown className="h-4 w-4" aria-hidden="true" />
            {context?.isExportingImage ? "Đang tạo ảnh..." : "Tải ảnh"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

