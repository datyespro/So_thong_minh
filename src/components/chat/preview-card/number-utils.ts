export function formatVietnameseMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Chưa có";
  }

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} đ`;
}

export function parseVietnameseNumber(input: string): number | null {
  const lowered = input
    .trim()
    .toLowerCase()
    .replace(/đ|vnd|vnđ/g, "")
    .replace(/\s+/g, " ");

  if (!lowered) {
    return null;
  }

  let multiplier = 1;
  let numericText = lowered;

  if (/\b(k|nghìn|nghin|ngàn|ngan)\b/.test(numericText) || /\d+k\b/.test(numericText)) {
    multiplier = 1_000;
    numericText = numericText.replace(/k\b|\b(nghìn|nghin|ngàn|ngan)\b/g, "");
  }

  if (numericText.includes("triệu") || numericText.includes("trieu")) {
    multiplier = 1_000_000;
    numericText = numericText.replace(/triệu|trieu/g, "");
  }

  numericText = numericText.trim();

  if (!/^[\d.,\s]+$/.test(numericText)) {
    return null;
  }

  let normalized: string;

  if (multiplier > 1) {
    normalized = numericText.replace(/\s/g, "").replace(",", ".");
  } else {
    normalized = numericText.replace(/[\s.,]/g, "");
  }

  if (!normalized || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * multiplier);
}
