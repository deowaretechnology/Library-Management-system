/**
 * India Standard Time helpers. The app runs on Vercel, whose servers are on UTC, but the
 * library operates on IST — without these, "today", due dates and entry/exit times were
 * all off by 5h30m (a book issued at 2 AM IST showed a due date one day early, the
 * dashboard's "issued today" reset at 5:30 AM, gate scans were logged in UTC, etc.).
 *
 * IST has no daylight saving, so a fixed +05:30 offset is exact.
 */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const IST_TIMEZONE = "Asia/Kolkata";

/** The IST calendar date of `d` as Y/M/D parts (month 0-based). */
function istParts(d: Date) {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

/** 00:00:00.000 IST of the day `d` falls on (IST), as a real instant. */
export function startOfIstDay(d: Date = new Date()): Date {
  const { y, m, day } = istParts(d);
  return new Date(Date.UTC(y, m, day, 0, 0, 0, 0) - IST_OFFSET_MS);
}

/**
 * 23:59:59.999 IST, `days` calendar days after the IST day `from` falls on. Used for due
 * dates: a book "due Oct 3" is now due at the very END of Oct 3 IST, so returning it any
 * time on Oct 3 never counts as a day late (previously the due instant was the exact issue
 * timestamp + N days, so a same-day evening return was already fined for 1 day).
 */
export function endOfIstDayAfter(from: Date, days: number): Date {
  const { y, m, day } = istParts(from);
  return new Date(Date.UTC(y, m, day + days, 23, 59, 59, 999) - IST_OFFSET_MS);
}

/** "HH:mm" in IST. */
export function istTimeHHmm(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** "YYYY-MM-DD" of the IST calendar day. */
export function istDayKey(d: Date): string {
  const { y, m, day } = istParts(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Human date in IST, e.g. "3 Oct 2026". */
export function formatIstDate(d: Date | string | number): string {
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
