export function formatVietnameseMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Chưa có";
  }

  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(value))} đ`;
}
