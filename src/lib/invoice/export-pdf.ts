"use client";

// FIX-2: tìm mép cắt an toàn cho phân trang PDF — dò NGƯỢC từ idealCutY về minCutY,
// lấy scanline trắng (khe giữa 2 dòng) đầu tiên gặp để KHÔNG xén ngang một dòng.
// Không thấy scanline trắng nào trong cửa sổ (dòng cao hơn cửa sổ dò) → trả idealCutY
// (cắt cứng, fallback). Thuần: nhận predicate, không đụng canvas → test bằng mock.
export function findSafeCutY(
  isRowBlank: (y: number) => boolean,
  idealCutY: number,
  minCutY: number,
): number {
  for (let y = idealCutY; y >= minCutY; y--) {
    if (isRowBlank(y)) {
      return y;
    }
  }
  return idealCutY;
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  });

  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error("Invoice element rendered to an empty canvas.");
  }

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const usableHeight = pageHeight - margin * 2;

  const pdf = new jsPDF("portrait", "mm", "a4");
  const imgData = canvas.toDataURL("image/png");

  // FIX-2: cắt canvas thành từng trang tại scanline trắng (khe dòng) thay vì vẽ lại
  // nguyên ảnh dịch offset cố định — tránh xén ngang một dòng ở mép giữa 2 trang.
  const pxPerMm = canvas.width / imgWidth;
  const pageSlicePx = Math.max(1, Math.floor(usableHeight * pxPerMm));
  const ctx = canvas.getContext("2d");

  if (canvas.height <= pageSlicePx || !ctx) {
    // 1 trang (hoặc không lấy được 2d context → fallback vẽ nguyên ảnh như cũ).
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const STEP = 4; // lấy mẫu mỗi 4 px ngang cho nhanh
    const NEAR_WHITE = 250; // r,g,b ≥ 250 coi như trắng
    const isRowBlank = (y: number) => {
      const rowStart = y * canvas.width * 4;
      for (let x = 0; x < canvas.width; x += STEP) {
        const i = rowStart + x * 4;
        if (
          pixels[i] < NEAR_WHITE ||
          pixels[i + 1] < NEAR_WHITE ||
          pixels[i + 2] < NEAR_WHITE
        ) {
          return false;
        }
      }
      return true;
    };

    let startY = 0;
    let firstPage = true;
    while (startY < canvas.height) {
      const idealCut = Math.min(startY + pageSlicePx, canvas.height);
      // dò ngược tới tối thiểu 60% trang để không tạo trang quá ngắn / kẹt vòng lặp.
      const minCut = Math.min(idealCut, startY + Math.floor(pageSlicePx * 0.6));
      const cutY =
        idealCut < canvas.height
          ? findSafeCutY(isRowBlank, idealCut, minCut)
          : idealCut;
      const sliceH = cutY - startY;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const pageCtx = pageCanvas.getContext("2d");
      if (pageCtx) {
        pageCtx.drawImage(
          canvas,
          0,
          startY,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH,
        );
      }

      if (!firstPage) {
        pdf.addPage();
      }
      pdf.addImage(
        pageCanvas.toDataURL("image/png"),
        "PNG",
        margin,
        margin,
        imgWidth,
        sliceH / pxPerMm,
      );
      firstPage = false;
      startY = cutY;
    }
  }

  pdf.save(filename);
}

export async function exportElementToImage(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
  });

  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error("Invoice element rendered to an empty canvas.");
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });

  const url = URL.createObjectURL(blob);

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
