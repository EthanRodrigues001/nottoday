import { addDays, daysBetween, fromDay, toDay, type Day } from './dates.ts';

/** How a task comes back after it is done. */
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const REPEATS: readonly Repeat[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

export function isRepeat(value: unknown): value is Repeat {
  return typeof value === 'string' && (REPEATS as readonly string[]).includes(value);
}

/** The largest "every N" a repeat accepts. */
export const MAX_EVERY = 99;

/** An interval as a whole number from 1 to 99; anything else becomes 1. */
export function normalizeEvery(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_EVERY ? value : 1;
}

const UNIT: Record<Exclude<Repeat, 'none'>, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

/** Words for a repeat, as shown on a task: "Every day", "Every 3 weeks". */
export function repeatLabel(repeat: Repeat, every = 1): string {
  if (repeat === 'none') return 'Never';
  return every === 1 ? `Every ${UNIT[repeat]}` : `Every ${every} ${UNIT[repeat]}s`;
}

/** The short form for a task row: "daily", "every 3 weeks". */
export function repeatShort(repeat: Repeat, every = 1): string {
  if (repeat === 'none') return '';
  if (every === 1) return { daily: 'daily', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' }[repeat];
  return `every ${every} ${UNIT[repeat]}s`;
}

/** Days between two occurrences at most; used to jump close to a day without stepping through every one. */
const LONGEST_STEP: Record<Exclude<Repeat, 'none'>, number> = { daily: 1, weekly: 7, monthly: 31, yearly: 366 };

/** The day of month or year kept inside the shorter month: 31 Jan repeats on 28 Feb, then 31 Mar again. 29 Feb repeats on 28 Feb in other years. */
function inMonth(year: number, month: number, dayOfMonth: number): Day {
  const first = new Date(year, month, 1, 12);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(dayOfMonth, last));
  return toDay(first);
}

/** The `n`th day a repeating task is due, counted from its first day (`n` = 0 is that day). `every` is the gap in units. */
export function occurrence(anchor: Day, repeat: Exclude<Repeat, 'none'>, n: number, every = 1): Day {
  const d = fromDay(anchor);
  n *= every;
  switch (repeat) {
    case 'daily':
      return addDays(anchor, n);
    case 'weekly':
      return addDays(anchor, 7 * n);
    case 'monthly':
      return inMonth(d.getFullYear(), d.getMonth() + n, d.getDate());
    case 'yearly':
      return inMonth(d.getFullYear() + n, d.getMonth(), d.getDate());
  }
}

/**
 * The first day after `after` that a repeating task falls on. Always counted from the first day, never from
 * the previous one, so a monthly task on the 31st does not slide to the 28th for good after February.
 */
export function nextAfter(anchor: Day, repeat: Exclude<Repeat, 'none'>, after: Day, every = 1): Day {
  const gap = daysBetween(anchor, after);
  let n = gap > 0 ? Math.floor(gap / (LONGEST_STEP[repeat] * every)) : 0;
  while (occurrence(anchor, repeat, n, every) <= after) n++;
  return occurrence(anchor, repeat, n, every);
}
