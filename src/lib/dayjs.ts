import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/vi";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("vi");

// The shop's wall-clock timezone. The DB runs in UTC, so "today" for a business
// record must be computed here, not from CURRENT_DATE, or an early-morning sale
// would land on the previous day.
export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Today's date (YYYY-MM-DD) in the shop's timezone, for business_date. */
export function businessDateVN(): string {
  return dayjs().tz(APP_TIME_ZONE).format("YYYY-MM-DD");
}

export { dayjs };
