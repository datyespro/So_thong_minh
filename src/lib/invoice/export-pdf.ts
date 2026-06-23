"use client";

// FIX-3: chọn các mép cắt trang sao cho KHÔNG cắt giữa một dòng.
// boundaries: các Y (canvas px) là ĐÁY của từng dòng/khối "nguyên khối" (đã sort tăng,
// nằm trong (0, totalHeight)). Trả mảng Y cắt (KHÔNG gồm 0 và totalHeight); mỗi trang
// ≤ pageSlicePx. Mỗi trang lấy boundary LỚN NHẤT trong (startY, startY+pageSlicePx];
// không có (dòng cao hơn 1 trang) → cắt cứng tại startY+pageSlicePx (fallback, hiếm)
// để đảm bảo tiến trình. Thuần (chỉ số học) → test bằng mảng, không cần DOM/canvas.
export function pickPageCuts(
  boundaries: number[],
  totalHeight: number,
  pageSlicePx: number,
): number[] {
  const cuts: number[] = [];
  let startY = 0;
  while (totalHeight - startY > pageSlicePx) {
    const ideal = startY + pageSlicePx;
    let cut = -1;
    for (const b of boundaries) {
      if (b > startY && b <= ideal && b > cut) {
        cut = b;
      }
    }
    if (cut <= startY) {
      cut = ideal; // fallback: dòng cao hơn 1 trang → cắt cứng
    }
    cuts.push(cut);
    startY = cut;
  }
  return cuts;
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  // FIX-3: đo mép DÒNG từ DOM TRƯỚC html2canvas — element đã layout đúng khổ in
  // (210mm) nhờ caller. Ứng viên mép cắt = ĐÁY mỗi <tr> + đáy các khối nguyên khối
  // (header/section/table/footer…), tính theo Y tương đối element (CSS px).
  const elementRect = element.getBoundingClientRect();
  const boundaryEls = element.querySelectorAll(
    "tr, thead, tbody, section, header, footer, table",
  );
  const domBoundaries = Array.from(boundaryEls)
    .map((el) => el.getBoundingClientRect().bottom - elementRect.top)
    .filter((y) => y > 0 && y < elementRect.height);

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

  // FIX-3: cắt canvas theo mép DÒNG (đo từ DOM) thay vì dò scanline trắng — bảng viền
  // lưới đầy đủ không có scanline ngang nào trắng nên FIX-2 cắt cứng giữa dòng.
  const pxPerMm = canvas.width / imgWidth;
  const pageSlicePx = Math.max(1, Math.floor(usableHeight * pxPerMm));

  if (canvas.height <= pageSlicePx) {
    // 1 trang như cũ.
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    // CSS px → canvas px. Map mép DÒNG sang toạ độ canvas, khử trùng + sort.
    const ratio = canvas.height / elementRect.height;
    const boundaries = Array.from(
      new Set(domBoundaries.map((y) => Math.round(y * ratio))),
    )
      .filter((y) => y > 0 && y < canvas.height)
      .sort((a, b) => a - b);

    const cuts = pickPageCuts(boundaries, canvas.height, pageSlicePx);
    const pages = [0, ...cuts, canvas.height];

    for (let i = 0; i < pages.length - 1; i++) {
      const sliceStart = pages[i];
      const sliceH = pages[i + 1] - sliceStart;
      if (sliceH <= 0) continue;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const pageCtx = pageCanvas.getContext("2d");
      if (pageCtx) {
        pageCtx.drawImage(
          canvas,
          0,
          sliceStart,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH,
        );
      }

      if (i > 0) {
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
