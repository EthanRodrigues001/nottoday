/** A calendar day as `YYYY-MM-DD` in the user's local time zone. */
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parse a Day into a Date at local noon, which stays on the same calendar day across DST shifts. */
export function fromDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(day: Day, n: number): Day {
  const date = fromDay(day);
  date.setDate(date.getDate() + n);
  return toDay(date);
}

/** Whole days from `a` to `b`; positive when `b` is later. */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((fromDay(b).getTime() - fromDay(a).getTime()) / 86_400_000);
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: Day): Day {
  const dow = (fromDay(day).getDay() + 6) % 7; // Mon = 0
  return addDays(day, -dow);
}

export function weekDays(day: Day): Day[] {
  const start = startOfWeek(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return toDay(fromDay(day)) === day;
}

/** `HH:mm` 24-hour time of day. */
export type TimeOfDay = string;

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function startOfMonth(day: Day): Day {
  return `${day.slice(0, 8)}01`;
}

/** The same day-of-month `n` months away, kept inside the target month (31 Jan + 1 month is 28 Feb). */
export function addMonths(day: Day, n: number): Day {
  const d = fromDay(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toDay(target);
}

/** Every day shown on a Monday-first month grid: whole weeks, so the first and last row may spill into the next month. */
export function monthGrid(day: Day): Day[] {
  const first = startOfMonth(day);
  const d = fromDay(first);
  const lastOfMonth = toDay(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(lastOfMonth), 6);
  const days: Day[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) days.push(cur);
  return days;
}

/** `HH:mm` moved by `minutes`, wrapping around midnight. */
export function shiftTime(time: TimeOfDay, minutes: number): TimeOfDay {
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
