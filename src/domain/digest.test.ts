import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Birthday } from './birthdays.ts';
import { eveningNudge, morningDigest } from './digest.ts';
import type { Task } from './planner.ts';

const task = (id: string, day: string, order = 0, doneOn: string | null = null): Task => ({
  id,
  title: `Task ${id}`,
  day,
  time: null,
  order,
  slips: 0,
  notes: '',
  repeat: 'none',
  every: 1,
  repeatFrom: null,
  series: null,
  doneOn,
});
const riya: Birthday = { id: 'riya', name: 'Riya', month: 11, dayOfMonth: 2, birthYear: null };

describe('morningDigest', () => {
  it('counts open tasks and mentions the Inbox', () => {
    const r = morningDigest('2026-11-01', '2026-11-01', [task('a', '2026-11-01'), task('b', '2026-11-01', 1)], [], [], 2);
    assert.deepEqual(r, { title: 'Today', body: '2 tasks · 2 in Inbox' });
  });

  it('puts a birthday in the title', () => {
    const r = morningDigest('2026-11-02', '2026-11-01', [task('a', '2026-11-02')], [riya], [], 0);
    assert.equal(r?.title, 'Wish Riya a happy birthday');
    assert.equal(r?.body, '1 task');
  });

  it('says nothing on a quiet day', () => {
    assert.equal(morningDigest('2026-11-01', '2026-11-01', [], [], [], 0), null);
  });

  it('ignores done tasks and wished birthdays', () => {
    const wishes = [{ birthdayId: 'riya', year: 2026, wishedOn: '2026-11-02' }];
    assert.equal(morningDigest('2026-11-02', '2026-11-02', [task('a', '2026-11-02', 0, '2026-11-02')], [riya], wishes, 0), null);
  });
});

describe('eveningNudge', () => {
  it('names the first open task', () => {
    const r = eveningNudge('2026-11-01', [task('a', '2026-11-01'), task('b', '2026-11-01', 1)]);
    assert.deepEqual(r, { title: '2 tasks left today', body: 'Task a and 1 more' });
  });

  it('is silent when nothing is open', () => {
    assert.equal(eveningNudge('2026-11-01', [task('a', '2026-11-01', 0, '2026-11-01')]), null);
  });
});
