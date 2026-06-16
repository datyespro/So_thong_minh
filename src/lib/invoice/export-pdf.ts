"use client";

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

  let remainingHeight = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);

  if (imgHeight > usableHeight) {
    remainingHeight -= usableHeight;

    while (remainingHeight > 0) {
      position -= usableHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      remainingHeight -= usableHeight;
    }
  }

  pdf.save(filename);
}
