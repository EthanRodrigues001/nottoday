import { daysBetween, toDay, type Day } from './dates.ts';

export type Birthday = {
  id: string;
  name: string;
  month: number; // 1-12
  dayOfMonth: number; // 1-31
  /** Optional, so a card can say "turns 22". */
  birthYear: number | null;
};

/** One year's wish for a person, with the day it was sent. */
export type Wish = { birthdayId: string; year: number; wishedOn: Day };

/** A Birthday stays on Today for this many days after its date if it was not wished. */
export const BELATED_DAYS = 3;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The day a birthday falls in `year`. A 29 February birthday is kept on 28 February in non-leap years. */
export function occurrenceIn(b: Birthday, year: number): Day {
  const dom = b.month === 2 && b.dayOfMonth === 29 && !isLeap(year) ? 28 : b.dayOfMonth;
  return toDay(new Date(year, b.month - 1, dom, 12));
}

export type BirthdayItem = {
  birthday: Birthday;
  /** Year of the occurrence this item is about. */
  year: number;
  belated: boolean;
  wishedOn: Day | null;
  /** Age being turned, when the birth year is known. */
  turns: number | null;
};

function itemFor(b: Birthday, year: number, wishes: Wish[], belated: boolean): BirthdayItem {
  const wish = wishes.find((w) => w.birthdayId === b.id && w.year === year);
  return {
    birthday: b,
    year,
    belated,
    wishedOn: wish ? wish.wishedOn : null,
    turns: b.birthYear === null ? null : year - b.birthYear,
  };
}

/**
 * Birthdays to show for a day. On the day itself every birthday appears (wished or not).
 * When `day` is today, unwished birthdays from the last few days also appear as belated.
 */
export function birthdaysFor(day: Day, today: Day, birthdays: Birthday[], wishes: Wish[]): BirthdayItem[] {
  const year = Number(day.slice(0, 4));
  const items: BirthdayItem[] = [];
  for (const b of birthdays) {
    if (occurrenceIn(b, year) === day) items.push(itemFor(b, year, wishes, false));
  }
  if (day === today) {
    for (const b of birthdays) {
      for (const y of [year, year - 1]) {
        const occ = occurrenceIn(b, y);
        const ago = daysBetween(occ, today);
        if (ago >= 1 && ago <= BELATED_DAYS) {
          const item = itemFor(b, y, wishes, true);
          if (item.wishedOn === null) items.push(item);
        }
      }
    }
  }
  return items.sort((a, b) => a.birthday.name.localeCompare(b.birthday.name));
}

/**
 * Each person's next birthday, if it falls within `withinDays`, nearest first. A person appears once,
 * however long the window is. Used for the morning digest and the list on the Later screen.
 */
export function upcoming(today: Day, birthdays: Birthday[], withinDays: number): { birthday: Birthday; day: Day; inDays: number }[] {
  const year = Number(today.slice(0, 4));
  const out: { birthday: Birthday; day: Day; inDays: number }[] = [];
  for (const b of birthdays) {
    for (const y of [year, year + 1]) {
      const day = occurrenceIn(b, y);
      const inDays = daysBetween(today, day);
      if (inDays < 0) continue; // already passed this year, so look at next year
      if (inDays <= withinDays) out.push({ birthday: b, day, inDays });
      break; // the first one that has not passed is the next one
    }
  }
  return out.sort((x, y) => x.inDays - y.inDays || x.birthday.name.localeCompare(y.birthday.name));
}

export function recordWish(wishes: Wish[], birthdayId: string, year: number, wishedOn: Day): Wish[] {
  return [...wishes.filter((w) => !(w.birthdayId === birthdayId && w.year === year)), { birthdayId, year, wishedOn }];
}

export function clearWish(wishes: Wish[], birthdayId: string, year: number): Wish[] {
  return wishes.filter((w) => !(w.birthdayId === birthdayId && w.year === year));
}
