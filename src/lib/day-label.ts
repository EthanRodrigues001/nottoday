import type { Repeat } from '@/domain/repeat';
import { addDays, fromDay, type Day } from '@/domain/dates';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Tomorrow", or "Sat, 28 Nov"; "Someday" for no day. */
export function dayLabel(day: Day | null, today: Day): string {
  if (day === null) return 'Someday';
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  const d = fromDay(day);
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** What a repeat means for a task on `day`, in words: "On the 5th of every month". */
export function repeatSummary(repeat: Repeat, day: Day, every = 1): string {
  const d = fromDay(day);
  if (every > 1 && repeat !== 'none') {
    const unit = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' }[repeat];
    const base = `Every ${every} ${unit}`;
    if (repeat === 'weekly') return `${base}, on ${WEEKDAY_LONG[d.getDay()]}`;
    if (repeat === 'monthly') return `${base}, on the ${ordinal(d.getDate())}`;
    if (repeat === 'yearly') return `${base}, on ${d.getDate()} ${MONTH[d.getMonth()]}`;
    return `${base} once you finish it`;
  }
  switch (repeat) {
    case 'none':
      return 'Does not repeat';
    case 'daily':
      return 'Comes back every day once you finish it';
    case 'weekly':
      return `Every ${WEEKDAY_LONG[d.getDay()]}`;
    case 'monthly':
      return `On the ${ordinal(d.getDate())} of every month`;
    case 'yearly':
      return `Every ${d.getDate()} ${MONTH[d.getMonth()]}`;
  }
}
