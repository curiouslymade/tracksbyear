/** Date helpers. All dates are UTC midnight, so time zones never move a day. */

const PARTIAL_DATE = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

/** Parses `yyyy`, `yyyy-mm` or `yyyy-mm-dd` to the first day it covers. */
export function parsePartialDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = PARTIAL_DATE.exec(value.trim());
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  const day = m[3] ? Number(m[3]) : 1;
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parses an ISO `yyyy-mm-dd` date and moves it to the last moment of that day. */
export function endOfDay(value: string): Date {
  const d = parsePartialDate(value) ?? new Date(NaN);
  return new Date(d.getTime() + 86_399_999);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function startOfYear(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

export function endOfYear(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

export function midpoint(a: Date, b: Date): Date {
  return new Date(Math.round((a.getTime() + b.getTime()) / 2));
}

export function maxDate(...dates: (Date | undefined)[]): Date | undefined {
  return dates.reduce<Date | undefined>((acc, d) => (d && (!acc || d > acc) ? d : acc), undefined);
}

export function minDate(...dates: (Date | undefined)[]): Date | undefined {
  return dates.reduce<Date | undefined>((acc, d) => (d && (!acc || d < acc) ? d : acc), undefined);
}

export function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "9 Nov 1989" */
export function formatDay(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatMonth(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A short, readable range: "1997", "May 1997 to Mar 1998" or "1997 to 2003". */
export function formatRange(from: Date, to: Date): string {
  const fy = from.getUTCFullYear();
  const ty = to.getUTCFullYear();
  const months = (ty - fy) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (fy === ty && months >= 11) return String(fy);
  if (months <= 18) {
    const a = formatMonth(from);
    const b = formatMonth(to);
    return a === b ? a : `${a} to ${b}`;
  }
  return `${fy} to ${ty}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Shows an ISO partial date the UK way: "02/10/1995", "10/1995" or "1995". */
export function formatUkDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (d) return `${d}/${m}/${y}`;
  if (m) return `${m}/${y}`;
  return y;
}

/**
 * Reads a date that the user typed: "2/10/1995", "10/1995", "1995", or an ISO date.
 * Returns an ISO partial date, or undefined if the date is not valid.
 */
export function readUkDate(text: string): string | undefined {
  const s = text.trim();
  let iso: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) iso = `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}`;
  else if ((m = /^(\d{1,2})[/.-](\d{4})$/.exec(s))) iso = `${m[2]}-${pad2(+m[1])}`;
  else if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s)) iso = s;
  if (!iso) return undefined;
  const d = parsePartialDate(iso);
  if (!d) return undefined;
  // Reject dates that roll over, such as 31/02/1995.
  const [y, mo, da] = iso.split('-').map(Number);
  if (mo !== undefined && (mo < 1 || mo > 12)) return undefined;
  if (da !== undefined && d.getUTCDate() !== da) return undefined;
  if (d.getUTCFullYear() !== y) return undefined;
  return iso;
}

/** The first year the app accepts for a release date. */
const FIRST_RELEASE_YEAR = 1900;

/**
 * Checks a release date that the user typed. Returns the ISO date, or a message
 * that says what is wrong. An empty field is allowed: it clears the date.
 */
export function checkReleaseDate(text: string, today: Date): { iso?: string; error?: string } {
  const s = text.trim();
  if (!s) return {};
  const shaped = /^(\d{1,2}[/.-]){0,2}\d{4}$/.test(s) || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(s);
  if (!shaped) return { error: 'Enter the date as dd/mm/yyyy, mm/yyyy or yyyy.' };
  const iso = readUkDate(s);
  if (!iso) return { error: 'That date does not exist. Check the day and the month.' };
  const year = Number(iso.slice(0, 4));
  if (year < FIRST_RELEASE_YEAR) return { error: `Enter a year from ${FIRST_RELEASE_YEAR}.` };
  const date = parsePartialDate(iso)!;
  if (date.getTime() > today.getTime()) return { error: 'The release date cannot be in the future.' };
  return { iso };
}
