import { birthdaysFor, type Birthday, type Wish } from './birthdays.ts';
import type { Day } from './dates.ts';
import { openTasksOn, type Task } from './planner.ts';

export type Reminder = { title: string; body: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The morning message for `day`: how many tasks, which birthdays, and how many suggestions wait in the Inbox.
 * Returns null when there is nothing to say, so a quiet day sends nothing.
 */
export function morningDigest(
  day: Day,
  today: Day,
  tasks: Task[],
  birthdays: Birthday[],
  wishes: Wish[],
  inboxCount: number,
): Reminder | null {
  const open = openTasksOn(tasks, day);
  const people = birthdaysFor(day, today, birthdays, wishes).filter((b) => b.wishedOn === null);
  if (open.length === 0 && people.length === 0 && inboxCount === 0) return null;

  const parts: string[] = [];
  if (open.length > 0) parts.push(plural(open.length, 'task', 'tasks'));
  if (inboxCount > 0) parts.push(`${inboxCount} in Inbox`);
  const body = parts.join(' · ');

  if (people.length > 0) {
    const names = people.map((p) => p.birthday.name);
    const who = names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} others`;
    return { title: `Wish ${who} a happy birthday`, body: body || 'Nothing else planned' };
  }
  return { title: 'Today', body };
}

/** The evening nudge: only when something due today is still open. */
export function eveningNudge(today: Day, tasks: Task[]): Reminder | null {
  const open = openTasksOn(tasks, today);
  if (open.length === 0) return null;
  const first = open[0].title;
  return {
    title: plural(open.length, 'task', 'tasks') + ' left today',
    body: open.length === 1 ? first : `${first} and ${open.length - 1} more`,
  };
}
