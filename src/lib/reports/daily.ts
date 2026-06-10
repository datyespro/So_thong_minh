import { APP_TIME_ZONE, businessDateVN, dayjs } from "@/src/lib/dayjs";

const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidReportDate(value: string) {
  if (!REPORT_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = dayjs.tz(value, APP_TIME_ZONE);

  return parsed.isValid() && parsed.format("YYYY-MM-DD") === value;
}

export function normalizeReportDate(param: string | undefined): string {
  return param && isValidReportDate(param) ? param : businessDateVN();
}

export function prevDate(date: string): string {
  return dayjs.tz(date, APP_TIME_ZONE).subtract(1, "day").format("YYYY-MM-DD");
}

export function nextDate(date: string): string {
  return dayjs.tz(date, APP_TIME_ZONE).add(1, "day").format("YYYY-MM-DD");
}

export function reportDateUtcRange(date: string): {
  startUtc: string;
  endUtc: string;
} {
  const start = dayjs.tz(`${date}T00:00:00`, APP_TIME_ZONE);

  return {
    startUtc: start.utc().toISOString(),
    endUtc: start.add(1, "day").utc().toISOString(),
  };
}
