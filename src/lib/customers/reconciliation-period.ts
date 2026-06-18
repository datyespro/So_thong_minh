export function earliestBusinessDate(rows: { business_date: string | null }[]): string | null {
  const dates = rows
    .map((r) => r.business_date)
    .filter((d): d is string => d !== null && d.trim() !== "");

  if (dates.length === 0) {
    return null;
  }

  dates.sort();
  return dates[0];
}
