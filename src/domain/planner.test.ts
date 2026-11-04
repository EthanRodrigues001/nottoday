import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  completeTask,
  createTask,
  dayProgress,
  deferTask,
  deleteTask,
  editTask,
  needsDecision,
  openTasksOn,
  reopenTask,
  reorder,
  rollOver,
  somedayTasks,
  type Plan,
} from './planner.ts';

const empty: Plan = { tasks: [], entries: [] };

function planWith(...titles: string[]): Plan {
  return titles.reduce((p, title, i) => createTask(p, { id: `t${i + 1}`, title, day: '2026-10-31' }), empty);
}

describe('createTask', () => {
  it('appends to the end of its day and trims the title', () => {
    const plan = createTask(planWith('a', 'b'), { id: 'x', title: '  c  ', day: '2026-10-31' });
    assert.deepEqual(openTasksOn(plan.tasks, '2026-10-31').map((t) => t.title), ['a', 'b', 'c']);
  });

  it('puts a task without a day in Someday and writes no day entry', () => {
    const plan = createTask(empty, { id: 'x', title: 'later', day: null });
    assert.equal(somedayTasks(plan.tasks).length, 1);
    assert.equal(plan.entries.length, 0);
  });
});

describe('rollOver', () => {
  it('moves an open task to today and counts one slip per missed day', () => {
    const plan = rollOver(planWith('a'), '2026-11-03');
    const task = plan.tasks[0];
    assert.equal(task.day, '2026-11-03');
    assert.equal(task.slips, 3);
    const slipped = plan.entries.filter((e) => e.outcome === 'slipped').map((e) => e.day);
    assert.deepEqual(slipped.sort(), ['2026-10-31', '2026-11-01', '2026-11-02']);
    assert.ok(plan.entries.some((e) => e.day === '2026-11-03' && e.outcome === 'planned'));
  });

  it('does nothing for tasks due today or later, done tasks, and Someday', () => {
    let plan = planWith('today', 'done');
    plan = completeTask(plan, 't2', '2026-10-31');
    plan = createTask(plan, { id: 's', title: 'someday', day: null });
    const rolled = rollOver(plan, '2026-10-31');
    assert.deepEqual(rolled.tasks, plan.tasks);
  });

  it('is idempotent', () => {
    const once = rollOver(planWith('a'), '2026-11-02');
    const twice = rollOver(once, '2026-11-02');
    assert.deepEqual(twice.tasks, once.tasks);
    assert.equal(twice.entries.length, once.entries.length);
  });

  it('flags a task for a decision after three slips', () => {
    assert.equal(needsDecision(rollOver(planWith('a'), '2026-11-02').tasks[0]), false);
    assert.equal(needsDecision(rollOver(planWith('a'), '2026-11-03').tasks[0]), true);
  });
});

describe('completeTask and reopenTask', () => {
  it('marks done and restores on reopen', () => {
    const done = completeTask(planWith('a'), 't1', '2026-10-31');
    assert.equal(done.tasks[0].doneOn, '2026-10-31');
    assert.equal(dayProgress(done.entries, '2026-10-31').fraction, 1);
    const back = reopenTask(done, 't1');
    assert.equal(back.tasks[0].doneOn, null);
    assert.equal(dayProgress(back.entries, '2026-10-31').fraction, 0);
  });
});

describe('deferTask', () => {
  it('moves to tomorrow, keeps slips, and stops counting against the old day', () => {
    let plan = rollOver(planWith('a', 'b'), '2026-11-01'); // both slip once
    plan = completeTask(plan, 't2', '2026-11-01');
    plan = deferTask(plan, 't1', '2026-11-02');
    const t1 = plan.tasks.find((t) => t.id === 't1')!;
    assert.equal(t1.day, '2026-11-02');
    assert.equal(t1.slips, 1);
    const p = dayProgress(plan.entries, '2026-11-01');
    assert.deepEqual([p.done, p.total], [1, 1]);
  });

  it('sends a task to Someday with null', () => {
    const plan = deferTask(planWith('a'), 't1', null);
    assert.equal(plan.tasks[0].day, null);
    assert.equal(dayProgress(plan.entries, '2026-10-31').hasItems, false);
  });

  it('appends to the end of the target day', () => {
    let plan = planWith('a', 'b');
    plan = createTask(plan, { id: 'n', title: 'next', day: '2026-11-01' });
    plan = deferTask(plan, 't1', '2026-11-01');
    assert.deepEqual(openTasksOn(plan.tasks, '2026-11-01').map((t) => t.id), ['n', 't1']);
  });
});

describe('reorder', () => {
  it('moves a task and renumbers the day', () => {
    const plan = planWith('a', 'b', 'c');
    const tasks = reorder(plan.tasks, '2026-10-31', 't3', 0);
    assert.deepEqual(openTasksOn(tasks, '2026-10-31').map((t) => t.id), ['t3', 't1', 't2']);
    assert.deepEqual(openTasksOn(tasks, '2026-10-31').map((t) => t.order), [0, 1, 2]);
  });

  it('clamps an out-of-range index', () => {
    const tasks = reorder(planWith('a', 'b').tasks, '2026-10-31', 't1', 99);
    assert.deepEqual(openTasksOn(tasks, '2026-10-31').map((t) => t.id), ['t2', 't1']);
  });
});

describe('deleteTask', () => {
  it('removes the task and its history', () => {
    const plan = deleteTask(rollOver(planWith('a'), '2026-11-01'), 't1');
    assert.equal(plan.tasks.length, 0);
    assert.equal(plan.entries.length, 0);
  });
});

describe('editTask', () => {
  it('changes title, notes and time without touching the day', () => {
    const plan = editTask(planWith('a'), 't1', { title: '  Write report ', notes: ' chapter 2 ', time: '09:30' });
    const task = plan.tasks[0];
    assert.equal(task.title, 'Write report');
    assert.equal(task.notes, 'chapter 2');
    assert.equal(task.time, '09:30');
    assert.equal(task.day, '2026-10-31');
  });

  it('keeps the old title when the new one is blank, and clears a time with null', () => {
    let plan = editTask(planWith('a'), 't1', { time: '08:00' });
    plan = editTask(plan, 't1', { title: '   ', time: null });
    assert.equal(plan.tasks[0].title, 'a');
    assert.equal(plan.tasks[0].time, null);
  });

  it('moving to a new day marks the old day moved and plans the new one', () => {
    const plan = editTask(planWith('a', 'b'), 't1', { day: '2026-11-03' });
    assert.equal(plan.tasks[0].day, '2026-11-03');
    assert.equal(dayProgress(plan.entries, '2026-10-31').total, 1);
    assert.equal(dayProgress(plan.entries, '2026-11-03').total, 1);
  });

  it('does not move a finished task', () => {
    const done = completeTask(planWith('a'), 't1', '2026-10-31');
    assert.equal(editTask(done, 't1', { day: '2026-11-05' }).tasks[0].day, '2026-10-31');
  });

  it('can send a task to Someday and ignores an unknown id', () => {
    assert.equal(editTask(planWith('a'), 't1', { day: null }).tasks[0].day, null);
    assert.equal(editTask(planWith('a'), 'nope', { title: 'x' }).tasks.length, 1);
  });
});

describe('repeating every N', () => {
  const every3 = createTask(empty, { id: 'r1', title: 'Water plants', day: '2026-10-31', repeat: 'daily', every: 3 });

  it('comes back every third day, counted from the first', () => {
    const plan = completeTask(every3, 'r1', '2026-10-31', 'r2');
    assert.equal(plan.tasks.find((t) => t.id === 'r2')?.day, '2026-11-03');
    assert.equal(plan.tasks.find((t) => t.id === 'r2')?.every, 3);
  });

  it('skips the days it was late for', () => {
    const plan = completeTask(every3, 'r1', '2026-11-05', 'r2');
    assert.equal(plan.tasks.find((t) => t.id === 'r2')?.day, '2026-11-06');
  });

  it('changes the interval in the details and re-anchors on the task day', () => {
    const edited = editTask(every3, 'r1', { repeat: 'weekly', every: 2 });
    assert.equal(edited.tasks[0].every, 2);
    assert.equal(edited.tasks[0].repeat, 'weekly');
    assert.equal(editTask(every3, 'r1', { every: 5 }).tasks[0].every, 5);
    assert.equal(editTask(every3, 'r1', { repeat: 'none' }).tasks[0].every, 1);
    assert.equal(editTask(every3, 'r1', { title: 'x' }).tasks[0].every, 3);
  });
});

describe('repeating tasks', () => {
  const repeating = (repeat: 'daily' | 'weekly' | 'monthly' | 'yearly', day = '2026-10-31') =>
    createTask(empty, { id: 'r1', title: 'Take vitamins', day, time: '08:00', notes: 'with water', repeat });

  it('creates the next occurrence when one is done, with the same title, time and notes', () => {
    const plan = completeTask(repeating('daily'), 'r1', '2026-10-31', 'r2');
    const next = plan.tasks.find((t) => t.id === 'r2');
    assert.equal(next?.day, '2026-11-01');
    assert.equal(next?.title, 'Take vitamins');
    assert.equal(next?.time, '08:00');
    assert.equal(next?.notes, 'with water');
    assert.equal(next?.series, 'r1');
    assert.equal(plan.tasks.find((t) => t.id === 'r1')?.doneOn, '2026-10-31');
  });

  it('does not add anything for a plain task or when no id is given', () => {
    assert.equal(completeTask(planWith('a'), 't1', '2026-10-31', 'x').tasks.length, 1);
    assert.equal(completeTask(repeating('daily'), 'r1', '2026-10-31').tasks.length, 1);
  });

  it('skips past days that were missed and the day it was ticked early', () => {
    // A daily task left for three days is rolled onto today, then ticked: the next one is tomorrow.
    const late = completeTask(rollOver(repeating('daily'), '2026-11-03'), 'r1', '2026-11-03', 'r2');
    assert.equal(late.tasks.find((t) => t.id === 'r2')?.day, '2026-11-04');
    // A weekly task due 7 Nov, ticked on 2 Nov, comes back on 14 Nov, not 9 Nov.
    const early = completeTask(repeating('weekly', '2026-11-07'), 'r1', '2026-11-02', 'r2');
    assert.equal(early.tasks.find((t) => t.id === 'r2')?.day, '2026-11-14');
  });

  it('keeps the day of month for a monthly task across a short month', () => {
    let plan = repeating('monthly', '2026-01-31');
    plan = completeTask(plan, 'r1', '2026-01-31', 'r2');
    assert.equal(plan.tasks.find((t) => t.id === 'r2')?.day, '2026-02-28');
    plan = completeTask(plan, 'r2', '2026-02-28', 'r3');
    assert.equal(plan.tasks.find((t) => t.id === 'r3')?.day, '2026-03-31');
  });

  it('never has two open occurrences of one series', () => {
    const once = completeTask(repeating('daily'), 'r1', '2026-10-31', 'r2');
    const twice = completeTask(reopenTask(once, 'r1'), 'r1', '2026-10-31', 'r3');
    assert.equal(twice.tasks.filter((t) => t.doneOn === null).length, 1);
  });

  it('takes the next occurrence away again when the task is reopened', () => {
    const done = completeTask(repeating('daily'), 'r1', '2026-10-31', 'r2');
    const back = reopenTask(done, 'r1');
    assert.deepEqual(back.tasks.map((t) => [t.id, t.doneOn]), [['r1', null]]);
    assert.equal(back.entries.some((e) => e.taskId === 'r2'), false);
  });

  it('can be made to repeat, changed, and stopped from the edit screen', () => {
    let plan = editTask(planWith('a'), 't1', { repeat: 'monthly' });
    assert.deepEqual([plan.tasks[0].repeat, plan.tasks[0].repeatFrom, plan.tasks[0].series], ['monthly', '2026-10-31', 't1']);
    plan = editTask(plan, 't1', { repeat: 'yearly' });
    assert.equal(plan.tasks[0].repeat, 'yearly');
    plan = editTask(plan, 't1', { repeat: 'none' });
    assert.deepEqual([plan.tasks[0].repeat, plan.tasks[0].repeatFrom, plan.tasks[0].series], ['none', null, null]);
  });

  it('moves the whole repeat when its day is picked, but not when it is only put off', () => {
    const picked = editTask(repeating('monthly', '2026-11-05'), 'r1', { day: '2026-11-10' });
    assert.equal(picked.tasks[0].repeatFrom, '2026-11-10');
    const putOff = deferTask(repeating('monthly', '2026-11-05'), 'r1', '2026-11-06');
    assert.equal(putOff.tasks[0].repeatFrom, '2026-11-05');
  });

  it('stops repeating when sent to Someday, and a task with no day cannot repeat', () => {
    assert.equal(editTask(repeating('daily'), 'r1', { day: null }).tasks[0].repeat, 'none');
    assert.equal(createTask(empty, { id: 's', title: 'x', day: null, repeat: 'daily' }).tasks[0].repeat, 'none');
  });
});
