import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { birthdaysFor, clearWish, occurrenceIn, recordWish, upcoming, type Birthday, type Wish } from './birthdays.ts';
import { addDays, addMonths, daysBetween, monthGrid, shiftTime, startOfWeek, weekDays } from './dates.ts';

const riya: Birthday = { id: 'riya', name: 'Riya', month: 11, dayOfMonth: 2, birthYear: 2004 };
const leap: Birthday = { id: 'leap', name: 'Leo', month: 2, dayOfMonth: 29, birthYear: null };
const newYear: Birthday = { id: 'ny', name: 'Nia', month: 12, dayOfMonth: 31, birthYear: null };

describe('dates', () => {
  it('adds days across month and year ends', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('counts whole days across a DST change', () => {
    assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
    assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  });

  it('starts weeks on Monday', () => {
    assert.equal(startOfWeek('2026-10-31'), '2026-10-26'); // Saturday
    assert.equal(startOfWeek('2026-11-01'), '2026-10-26'); // Sunday
    assert.deepEqual(weekDays('2026-10-26').length, 7);
  });
});

describe('birthdaysFor', () => {
  it('shows a birthday on its day with the age being turned', () => {
    const [item] = birthdaysFor('2026-11-02', '2026-11-02', [riya], []);
    assert.equal(item.turns, 22);
    assert.equal(item.belated, false);
    assert.equal(item.wishedOn, null);
  });

  it('shows an unwished birthday as belated for three days only', () => {
    for (const today of ['2026-11-03', '2026-11-04', '2026-11-05']) {
      const items = birthdaysFor(today, today, [riya], []);
      assert.equal(items.length, 1);
      assert.equal(items[0].belated, true);
    }
    assert.equal(birthdaysFor('2026-11-06', '2026-11-06', [riya], []).length, 0);
  });

  it('hides a belated birthday that was wished, and shows the wish on the day itself', () => {
    const wishes: Wish[] = [{ birthdayId: 'riya', year: 2026, wishedOn: '2026-11-02' }];
    assert.equal(birthdaysFor('2026-11-03', '2026-11-03', [riya], wishes).length, 0);
    assert.equal(birthdaysFor('2026-11-02', '2026-11-03', [riya], wishes)[0].wishedOn, '2026-11-02');
  });

  it('does not show belated birthdays on other days of the week strip', () => {
    assert.equal(birthdaysFor('2026-11-04', '2026-11-05', [riya], []).length, 0);
  });

  it('carries belated birthdays across New Year', () => {
    const items = birthdaysFor('2027-01-02', '2027-01-02', [newYear], []);
    assert.equal(items.length, 1);
    assert.equal(items[0].year, 2026);
  });

  it('keeps 29 February on 28 February in non-leap years', () => {
    assert.equal(occurrenceIn(leap, 2027), '2027-02-28');
    assert.equal(occurrenceIn(leap, 2028), '2028-02-29');
  });

  it('resets every year', () => {
    const wishes: Wish[] = [{ birthdayId: 'riya', year: 2026, wishedOn: '2026-11-02' }];
    assert.equal(birthdaysFor('2027-11-02', '2027-11-02', [riya], wishes)[0].wishedOn, null);
  });
});

describe('upcoming', () => {
  it('lists birthdays inside the window, nearest first, including next year', () => {
    const list = upcoming('2026-12-30', [newYear, riya], 7);
    assert.deepEqual(list.map((u) => [u.birthday.id, u.inDays]), [['ny', 1]]);
    assert.equal(upcoming('2026-12-30', [riya], 400)[0].day, '2027-11-02');
  });
});

describe('upcoming, long window', () => {
  it('lists a person once even when this year and next year both fit', () => {
    const list = upcoming('2026-11-01', [{ id: 'a', name: 'Amit', month: 11, dayOfMonth: 5, birthYear: null }], 400);
    assert.equal(list.length, 1);
    assert.equal(list[0].day, '2026-11-05');
  });

  it('counts a birthday today as today, not next year', () => {
    const list = upcoming('2026-11-02', [riya], 366);
    assert.deepEqual(list.map((u) => [u.day, u.inDays]), [['2026-11-02', 0]]);
  });
});

describe('wishes', () => {
  it('records one wish per person per year and can clear it', () => {
    let wishes = recordWish([], 'riya', 2026, '2026-11-02');
    wishes = recordWish(wishes, 'riya', 2026, '2026-11-03');
    assert.equal(wishes.length, 1);
    assert.equal(wishes[0].wishedOn, '2026-11-03');
    assert.equal(clearWish(wishes, 'riya', 2026).length, 0);
  });
});

describe('month grid and time helpers', () => {
  it('builds Monday-first whole weeks around a month', () => {
    const grid = monthGrid('2026-11-15'); // 1 Nov 2026 is a Sunday
    assert.equal(grid[0], '2026-10-26');
    assert.equal(grid.at(-1), '2026-12-06'); // 30 Nov is a Monday, so its week ends on 6 Dec
    assert.equal(grid.length % 7, 0);
    assert.equal(monthGrid('2027-02-10').length, 28); // 1 Feb 2027 is a Monday and the month has 28 days
  });

  it('moves by months and clamps to the shorter month', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
    assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
  });

  it('shifts times across midnight', () => {
    assert.equal(shiftTime('23:45', 30), '00:15');
    assert.equal(shiftTime('00:10', -30), '23:40');
  });
});
