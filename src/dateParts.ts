/**
 * Day, month and year parts of an ISO partial date, for the scroll wheels on phones.
 * Pure functions.
 */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface DateParts {
  year?: number;
  month?: number;
  day?: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The number of days in a month (1 to 12). With no month or year, 31. */
export function daysIn(year: number | undefined, month: number | undefined): number {
  if (!month) return 31;
  return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

/** Splits `yyyy`, `yyyy-mm` or `yyyy-mm-dd`. An empty or broken value gives no parts. */
export function splitIso(iso: string | undefined): DateParts {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(iso?.trim() ?? '');
  if (!m) return {};
  return { year: Number(m[1]), month: m[2] ? Number(m[2]) : undefined, day: m[3] ? Number(m[3]) : undefined };
}

/**
 * Joins the parts to an ISO date.
 * - "full": all three parts are necessary, else the result is ''.
 * - "partial": the year is necessary. A day without a month is left out.
 * A day after the end of the month moves back to the last day.
 */
export function joinParts({ year, month, day }: DateParts, mode: 'full' | 'partial'): string {
  if (!year) return '';
  if (mode === 'full' && (!month || !day)) return '';
  if (!month) return String(year);
  if (!day) return `${year}-${pad2(month)}`;
  return `${year}-${pad2(month)}-${pad2(Math.min(day, daysIn(year, month)))}`;
}

/** The years from `to` down to `from`, newest first. */
export function yearsDown(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => to - i);
}
