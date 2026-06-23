"use client";

import { Download, FileText, ImageDown, Printer, Trash2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { OrderDeleteModal } from "@/src/components/customers/order-delete-modal";
import { InvoiceSingleView } from "@/src/components/invoice/invoice-single-view";
import { InvoiceSummaryView } from "@/src/components/invoice/invoice-summary-view";
import { InvoiceItemListView } from "@/src/components/invoice/invoice-itemlist-view";
import { useHistoryFilter } from "@/src/components/customers/history-filter-provider";
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
  scope_label?: string | null;
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
  const { filteredRows, filteredTotal, isFiltered, filter } = useHistoryFilter();

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
        const defaultFilename = isFiltered
          ? `bang-ke-${filenamePart(customerName)}-${pdfDate()}.pdf`
          : `cong-no-${filenamePart(customerName)}-${pdfDate()}.pdf`;
          
        await exportVisibleInvoice(
          isFiltered ? ".invoice-itemlist-view" : ".invoice-summary-view",
          filename ?? defaultFilename,
        );
      } catch (error) {
        console.error("Failed to export summary invoice PDF", error);
        window.alert("Không xuất được PDF, thử lại sau ạ.");
      } finally {
        setIsExportingPdf(false);
      }
    },
    [customerName, exportVisibleInvoice, isFiltered],
  );

  const exportSummaryImage = useCallback(
    async (filename?: string) => {
      setIsExportingImage(true);

      try {
        const defaultFilename = isFiltered
          ? `bang-ke-${filenamePart(customerName)}-${pdfDate()}.png`
          : `cong-no-${filenamePart(customerName)}-${pdfDate()}.png`;

        await exportVisibleInvoiceImage(
          isFiltered ? ".invoice-itemlist-view" : ".invoice-summary-view",
          filename ?? defaultFilename,
        );
      } catch (error) {
        console.error("Failed to export summary invoice image", error);
        window.alert("Không xuất được ảnh, thử lại sau ạ.");
      } finally {
        setIsExportingImage(false);
      }
    },
    [customerName, exportVisibleInvoiceImage, isFiltered],
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
        ) : isFiltered ? (
          <InvoiceItemListView
            shopSettings={shopSettings}
            customerName={customerName}
            customerPhone={customerPhone}
            rows={filteredRows}
            total={filteredTotal}
            printDate={printDate}
            filter={filter}
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

export const POPOVER_GAP = 4;

// Pure: chọn hướng mở (lên/xuống) cho popover dựa trên chỗ trống quanh nút.
// Ưu tiên mở xuống (giữ hành vi cũ); thiếu chỗ dưới thì lật lên; cả hai chật
// thì chọn bên rộng hơn và kẹp top trong viewport. Không đụng DOM để test được.
export function resolvePopoverVerticalPlacement(args: {
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  menuHeight: number;
  gap?: number;
}): { direction: "up" | "down"; top: number } {
  const gap = args.gap ?? POPOVER_GAP;
  const spaceBelow = args.viewportHeight - args.triggerBottom;
  const spaceAbove = args.triggerTop;
  const need = args.menuHeight + gap;

  if (spaceBelow >= need) {
    return { direction: "down", top: args.triggerBottom + gap };
  }

  if (spaceAbove >= need) {
    return { direction: "up", top: args.triggerTop - gap - args.menuHeight };
  }

  if (spaceBelow >= spaceAbove) {
    return { direction: "down", top: args.triggerBottom + gap };
  }

  return {
    direction: "up",
    top: Math.max(gap, args.triggerTop - gap - args.menuHeight),
  };
}

// Dựng menu popover ra ngoài mọi khung overflow bằng portal + định vị fixed từ
// rect của nút bấm, tự lật lên khi thiếu chỗ. Đo menu (visibility:hidden) trước
// khi hiện để tránh nháy. Đóng khi click ngoài (nút + menu), ESC, hoặc scroll/resize.
function ActionPopoverMenu({
  open,
  onClose,
  triggerRef,
  children,
}: Readonly<{
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    const menu = menuRef.current;

    if (!trigger || !menu) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const { top } = resolvePopoverVerticalPlacement({
      triggerTop: rect.top,
      triggerBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      menuHeight: menuRect.height,
    });
    const rawLeft = rect.right - menuRect.width;
    const left = Math.max(
      8,
      Math.min(rawLeft, window.innerWidth - menuRect.width - 8),
    );

    setPosition({ top, left });
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    function handleReposition() {
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, onClose, triggerRef]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="no-print"
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        zIndex: 60,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

// Pure: nội dung menu hành động đơn (4 mục). Tách riêng để test bằng
// renderToStaticMarkup; phần định vị/portal do ActionPopoverMenu lo.
export function InvoiceActionMenuItems({
  onPrint,
  onPdf,
  onImage,
  onDelete,
  isExportingPdf,
  isExportingImage,
  disabled,
  showDelete,
}: Readonly<{
  onPrint: () => void;
  onPdf: () => void;
  onImage: () => void;
  onDelete: () => void;
  isExportingPdf: boolean;
  isExportingImage: boolean;
  disabled: boolean;
  showDelete: boolean;
}>) {
  return (
    <div
      role="menu"
      className="no-print w-40 max-w-[calc(100vw-2rem)] rounded border border-ledgerBorder bg-surface py-1 text-left shadow-[0_16px_40px_-18px_rgba(23,37,84,0.45),0_1px_0_var(--ledger-border)]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onPrint}
        className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        In hóa đơn
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onPdf}
        className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
        disabled={disabled || isExportingPdf}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {isExportingPdf ? "Đang tạo PDF" : "Tải PDF"}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onImage}
        className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-ink hover:bg-paperWarm disabled:cursor-not-allowed disabled:opacity-55"
        disabled={disabled || isExportingImage}
      >
        <ImageDown className="h-4 w-4" aria-hidden="true" />
        {isExportingImage ? "Đang tạo ảnh" : "Tải ảnh"}
      </button>
      {showDelete && (
        <>
          <div className="my-1 border-t border-ledgerBorder" />
          <button
            type="button"
            role="menuitem"
            onClick={onDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-[14px] font-semibold text-debt hover:bg-paperWarm"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Xóa đơn
          </button>
        </>
      )}
    </div>
  );
}

export function InvoiceActionPopover({
  orderId,
  itemCount,
  deletable,
  orderSummary,
}: Readonly<{
  orderId: string;
  itemCount: number;
  deletable?: boolean;
  orderSummary?: {
    businessDate: string | null;
    total: number;
    itemCount: number;
    firstItemName: string | null;
  };
}>) {
  const context = useContext(PrintOrderContext);
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const title =
    itemCount > 1 ? `In hóa đơn (${itemCount} món)` : "In hóa đơn";

  return (
    <div className="no-print relative inline-flex justify-end">
      <button
        ref={triggerRef}
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

      <ActionPopoverMenu open={open} onClose={closeMenu} triggerRef={triggerRef}>
        <InvoiceActionMenuItems
          onPrint={() => {
            setOpen(false);
            context?.printOrder(orderId);
          }}
          onPdf={() => {
            setOpen(false);
            context?.exportOrderPdf(orderId);
          }}
          onImage={() => {
            setOpen(false);
            context?.exportOrderImage(orderId);
          }}
          onDelete={() => {
            setOpen(false);
            setDeleteOpen(true);
          }}
          isExportingPdf={Boolean(context?.isExportingPdf)}
          isExportingImage={Boolean(context?.isExportingImage)}
          disabled={!context}
          showDelete={Boolean(deletable && orderSummary)}
        />
      </ActionPopoverMenu>
      {deletable && orderSummary && (
        <OrderDeleteModal
          open={deleteOpen}
          orderId={orderId}
          businessDate={orderSummary.businessDate}
          total={orderSummary.total}
          itemCount={orderSummary.itemCount}
          firstItemName={orderSummary.firstItemName}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            window.location.reload();
          }}
        />
      )}
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setOpen(false), []);
  const { isFiltered } = useHistoryFilter();

  return (
    <div className="no-print relative inline-flex">
      <Button
        ref={triggerRef}
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

      <ActionPopoverMenu open={open} onClose={closeMenu} triggerRef={triggerRef}>
        <div
          role="menu"
          className="no-print w-48 max-w-[calc(100vw-2rem)] rounded border border-ledgerBorder bg-surface py-1 text-left shadow-[0_16px_40px_-18px_rgba(23,37,84,0.45),0_1px_0_var(--ledger-border)]"
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
            {isFiltered ? "In bảng kê" : "In tổng hợp"}
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
      </ActionPopoverMenu>
    </div>
  );
}

