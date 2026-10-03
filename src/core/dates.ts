/**
 * Calendar dates ("JJJJ-MM-TT", local) and ISO weeks ("JJJJ-Www"). All arithmetic runs in UTC
 * on the date string, so time zones and daylight saving never shift a day.
 */

const DAY = 24 * 60 * 60 * 1000;

function toUtc(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY);
}

/** Whole days from a to b (b later → positive). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY);
}

/** ISO week of a date, e.g. "2026-W40". */
export function isoWeekOf(date: string): string {
  const ms = toUtc(date);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  const thursday = ms + (3 - weekday) * DAY;
  const year = new Date(thursday).getUTCFullYear();
  const firstThursday = Date.UTC(year, 0, 4);
  const firstWeekday = (new Date(firstThursday).getUTCDay() + 6) % 7;
  const week = 1 + Math.round((thursday - (firstThursday + (3 - firstWeekday) * DAY)) / (7 * DAY));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday and Sunday of an ISO week. */
export function weekRange(week: string): { start: string; end: string } {
  const [yearText, weekText] = week.split('-W');
  const year = Number(yearText);
  const jan4 = Date.UTC(year, 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  const start = monday + (Number(weekText) - 1) * 7 * DAY;
  return { start: fromUtc(start), end: fromUtc(start + 6 * DAY) };
}

export function shiftWeek(week: string, weeks: number): string {
  return isoWeekOf(addDays(weekRange(week).start, weeks * 7));
}

export function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Local calendar date of a moment (default: now). */
export function localDateOf(moment: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`;
}
