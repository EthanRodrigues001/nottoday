import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseBackup, serializeBackup, type BackupData } from './backup.ts';

const data: BackupData = {
  plan: {
    tasks: [
      { id: 't1', title: 'Finish DBMS', day: '2026-11-01', time: '17:00', order: 0, slips: 1, doneOn: null, notes: '', repeat: 'none', every: 1, repeatFrom: null, series: null },
      { id: 't2', title: 'Someday thing', day: null, time: null, order: 0, slips: 0, doneOn: null, notes: '', repeat: 'none', every: 1, repeatFrom: null, series: null },
    ],
    entries: [{ taskId: 't1', day: '2026-11-01', outcome: 'planned' }],
  },
  birthdays: [{ id: 'b1', name: 'Rahul', month: 11, dayOfMonth: 12, birthYear: 2004 }],
  wishes: [{ birthdayId: 'b1', year: 2025, wishedOn: '2025-11-12' }],
};

describe('backup', () => {
  it('round-trips exactly', () => {
    const result = parseBackup(serializeBackup(data, new Date(2026, 10, 1)));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data, data);
  });

  it('rejects text that is not JSON, or not this app', () => {
    assert.equal(parseBackup('hello').ok, false);
    assert.equal(parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} })).ok, false);
  });

  it('rejects a different version', () => {
    assert.equal(parseBackup(JSON.stringify({ app: 'nottoday', version: 2, data })).ok, false);
  });

  it('rejects damaged tasks and dates', () => {
    const bad = JSON.parse(serializeBackup(data, new Date()));
    bad.data.plan.tasks[0].day = '2026-13-45';
    assert.equal(parseBackup(JSON.stringify(bad)).ok, false);
    const bad2 = JSON.parse(serializeBackup(data, new Date()));
    bad2.data.plan.tasks[0].time = '25:99';
    assert.equal(parseBackup(JSON.stringify(bad2)).ok, false);
    const bad3 = JSON.parse(serializeBackup(data, new Date()));
    bad3.data.plan.tasks.push(bad3.data.plan.tasks[0]);
    assert.equal(parseBackup(JSON.stringify(bad3)).ok, false);
  });

  it('drops history and wishes that point at things that are not there', () => {
    const odd = JSON.parse(serializeBackup(data, new Date()));
    odd.data.plan.entries.push({ taskId: 'ghost', day: '2026-11-01', outcome: 'done' });
    odd.data.wishes.push({ birthdayId: 'ghost', year: 2025, wishedOn: '2025-11-12' });
    const result = parseBackup(JSON.stringify(odd));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.plan.entries.length, 1);
      assert.equal(result.data.wishes.length, 1);
    }
  });
});

describe('backup of repeating tasks', () => {
  const repeating: BackupData = {
    ...data,
    plan: {
      tasks: [{ id: 'r1', title: 'Pay rent', day: '2026-11-05', time: null, order: 0, slips: 0, doneOn: null, notes: '', repeat: 'monthly', every: 2, repeatFrom: '2026-11-05', series: 'r1' }],
      entries: [],
    },
  };

  it('keeps the repeat, its first day and its series', () => {
    const result = parseBackup(serializeBackup(repeating, new Date(2026, 10, 1)));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.plan.tasks, repeating.plan.tasks);
  });

  it('restores an older backup, which has no repeat fields, as plain tasks', () => {
    const old = JSON.parse(serializeBackup(data, new Date()));
    for (const t of old.data.plan.tasks) {
      delete t.repeat;
      delete t.every;
      delete t.repeatFrom;
      delete t.series;
      delete t.notes;
    }
    const result = parseBackup(JSON.stringify(old));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.plan.tasks.map((t) => [t.repeat, t.repeatFrom, t.series, t.notes]), [['none', null, null, ''], ['none', null, null, '']]);
  });

  it('drops a repeat that has nowhere to go or a bad value', () => {
    const bad = JSON.parse(serializeBackup(repeating, new Date()));
    bad.data.plan.tasks[0].repeat = 'hourly';
    const result = parseBackup(JSON.stringify(bad));
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual([result.data.plan.tasks[0].repeat, result.data.plan.tasks[0].repeatFrom], ['none', null]);
  });
});
