import type { ISODate } from "./models/common";

/**
 * Parses a date-only "YYYY-MM-DD" string as a LOCAL calendar date, not UTC midnight.
 * `new Date("2026-03-05")` parses as UTC midnight, which shifts to the previous day
 * once read back via local getters in any timezone behind UTC — every date-only
 * parse in this codebase must go through this function instead of the `Date`
 * constructor directly, to avoid that off-by-one-day class of bug.
 */
export function parseIsoDate(date: ISODate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

export function toIsoDate(d: Date): ISODate {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
