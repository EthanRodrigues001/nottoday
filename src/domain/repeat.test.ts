import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isRepeat, nextAfter, normalizeEvery, occurrence, repeatLabel, repeatShort } from './repeat.ts';

describe('occurrence', () => {
  it('steps by days and weeks', () => {
    assert.equal(occurrence('2026-12-30', 'daily', 3), '2027-01-02');
    assert.equal(occurrence('2026-11-02', 'weekly', 2), '2026-11-16');
  });

  it('keeps the day of month, shortened only in months that lack it', () => {
    assert.equal(occurrence('2026-01-31', 'monthly', 1), '2026-02-28');
    assert.equal(occurrence('2026-01-31', 'monthly', 2), '2026-03-31');
    assert.equal(occurrence('2026-11-15', 'monthly', 2), '2027-01-15');
  });

  it('repeats a 29 February task on 28 February in other years', () => {
    assert.equal(occurrence('2028-02-29', 'yearly', 1), '2029-02-28');
    assert.equal(occurrence('2028-02-29', 'yearly', 4), '2032-02-29');
  });
});

describe('nextAfter', () => {
  it('is the first occurrence strictly after the given day', () => {
    assert.equal(nextAfter('2026-11-01', 'daily', '2026-11-01'), '2026-11-02');
    assert.equal(nextAfter('2026-11-01', 'weekly', '2026-11-08'), '2026-11-15');
    assert.equal(nextAfter('2026-11-05', 'monthly', '2026-11-07'), '2026-12-05');
    assert.equal(nextAfter('2026-11-05', 'yearly', '2026-11-05'), '2027-11-05');
  });

  it('skips the occurrences that were missed', () => {
    assert.equal(nextAfter('2026-01-10', 'daily', '2026-03-01'), '2026-03-02');
    assert.equal(nextAfter('2026-01-05', 'monthly', '2026-09-20'), '2026-10-05');
  });

  it('counts from the first day, so the 31st comes back after February', () => {
    assert.equal(nextAfter('2026-01-31', 'monthly', '2026-02-28'), '2026-03-31');
  });

  it('works when the first day is still in the future', () => {
    assert.equal(nextAfter('2026-12-01', 'weekly', '2026-11-01'), '2026-12-01');
  });
});

describe('repeat helpers', () => {
  it('recognises the five choices and words them', () => {
    assert.ok(isRepeat('monthly'));
    assert.ok(!isRepeat('hourly'));
    assert.equal(repeatLabel('yearly'), 'Every year');
  });
});

describe('every N', () => {
  it('steps by the interval from the first day', () => {
    assert.equal(occurrence('2026-11-01', 'daily', 1, 3), '2026-11-04');
    assert.equal(occurrence('2026-11-01', 'weekly', 2, 2), '2026-11-29');
    assert.equal(occurrence('2026-01-31', 'monthly', 1, 3), '2026-04-30');
    assert.equal(occurrence('2026-03-05', 'yearly', 1, 2), '2028-03-05');
  });

  it('finds the next day after a date, never earlier than the interval allows', () => {
    // Every 3 days from the 1st: 1, 4, 7, 10 ...
    assert.equal(nextAfter('2026-11-01', 'daily', '2026-11-04', 3), '2026-11-07');
    assert.equal(nextAfter('2026-11-01', 'daily', '2026-11-05', 3), '2026-11-07');
    assert.equal(nextAfter('2026-11-01', 'daily', '2026-10-01', 3), '2026-11-01');
    // Every 2 months from 31 Jan: 31 Jan, 31 Mar, 31 May
    assert.equal(nextAfter('2026-01-31', 'monthly', '2026-02-01', 2), '2026-03-31');
    assert.equal(nextAfter('2026-01-10', 'weekly', '2026-09-20', 5), '2026-10-17');
  });

  it('words and bounds the interval', () => {
    assert.equal(repeatLabel('daily', 3), 'Every 3 days');
    assert.equal(repeatLabel('weekly', 2), 'Every 2 weeks');
    assert.equal(repeatLabel('monthly', 1), 'Every month');
    assert.equal(repeatShort('yearly', 1), 'yearly');
    assert.equal(repeatShort('monthly', 6), 'every 6 months');
    assert.equal(normalizeEvery(0), 1);
    assert.equal(normalizeEvery(2.5), 1);
    assert.equal(normalizeEvery(100), 1);
    assert.equal(normalizeEvery(14), 14);
  });
});
