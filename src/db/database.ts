import * as SQLite from 'expo-sqlite';

import type { Birthday, Wish } from '@/domain/birthdays';
import type { DayEntry, Outcome, Plan, Task } from '@/domain/planner';
import { isRepeat, normalizeEvery } from '@/domain/repeat';
import { WHATSAPP_SCHEMA } from '@/whatsapp/repository';

export type Snapshot = { plan: Plan; birthdays: Birthday[]; wishes: Wish[] };

export const emptySnapshot: Snapshot = { plan: { tasks: [], entries: [] }, birthdays: [], wishes: [] };

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  day TEXT,
  time TEXT,
  sort_order INTEGER NOT NULL,
  slips INTEGER NOT NULL DEFAULT 0,
  done_on TEXT,
  notes TEXT NOT NULL DEFAULT '',
  repeat TEXT NOT NULL DEFAULT 'none',
  repeat_every INTEGER NOT NULL DEFAULT 1,
  repeat_from TEXT,
  series TEXT
);
CREATE TABLE IF NOT EXISTS day_entries (
  task_id TEXT NOT NULL,
  day TEXT NOT NULL,
  outcome TEXT NOT NULL,
  PRIMARY KEY (task_id, day)
);
CREATE TABLE IF NOT EXISTS birthdays (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  month INTEGER NOT NULL,
  day_of_month INTEGER NOT NULL,
  birth_year INTEGER
);
CREATE TABLE IF NOT EXISTS wishes (
  birthday_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  wished_on TEXT NOT NULL,
  PRIMARY KEY (birthday_id, year)
);
`;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

/** The one shared connection. Every caller gets the same database, so two parts of the app never write over each other. */
export function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync('nottoday.db');
    await db.execAsync(SCHEMA + WHATSAPP_SCHEMA);
    // Databases made before a column existed get it here; a later run finds it and skips.
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(tasks)');
    const has = (name: string) => columns.some((c) => c.name === name);
    if (!has('notes')) await db.execAsync("ALTER TABLE tasks ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
    if (!has('repeat')) await db.execAsync("ALTER TABLE tasks ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none'");
    if (!has('repeat_every')) await db.execAsync('ALTER TABLE tasks ADD COLUMN repeat_every INTEGER NOT NULL DEFAULT 1');
    if (!has('repeat_from')) await db.execAsync('ALTER TABLE tasks ADD COLUMN repeat_from TEXT');
    if (!has('series')) await db.execAsync('ALTER TABLE tasks ADD COLUMN series TEXT');
    return db;
  })().catch((error) => {
    opening = null; // let the next call try again
    throw error;
  });
  return opening;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Reads and writes of the task tables run strictly one at a time. On one shared connection a read could
 * otherwise slip in between the delete and the inserts of a save and see a half-written (or empty) list,
 * and the app would then save that back over the real data.
 */
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

export function loadSnapshot(db: SQLite.SQLiteDatabase): Promise<Snapshot> {
  return exclusive(() => readSnapshot(db));
}

async function readSnapshot(db: SQLite.SQLiteDatabase): Promise<Snapshot> {
  const tasks = await db.getAllAsync<{
    id: string;
    title: string;
    day: string | null;
    time: string | null;
    sort_order: number;
    slips: number;
    done_on: string | null;
    notes: string | null;
    repeat: string | null;
    repeat_every: number | null;
    repeat_from: string | null;
    series: string | null;
  }>('SELECT * FROM tasks');
  const entries = await db.getAllAsync<{ task_id: string; day: string; outcome: string }>('SELECT * FROM day_entries');
  const birthdays = await db.getAllAsync<{
    id: string;
    name: string;
    month: number;
    day_of_month: number;
    birth_year: number | null;
  }>('SELECT * FROM birthdays');
  const wishes = await db.getAllAsync<{ birthday_id: string; year: number; wished_on: string }>('SELECT * FROM wishes');

  return {
    plan: {
      tasks: tasks.map(
        (r): Task => ({
          id: r.id,
          title: r.title,
          day: r.day,
          time: r.time,
          order: r.sort_order,
          slips: r.slips,
          doneOn: r.done_on,
          notes: r.notes ?? '',
          repeat: isRepeat(r.repeat) ? r.repeat : 'none',
          every: normalizeEvery(r.repeat_every),
          repeatFrom: r.repeat_from,
          series: r.series,
        }),
      ),
      entries: entries.map((r): DayEntry => ({ taskId: r.task_id, day: r.day, outcome: r.outcome as Outcome })),
    },
    birthdays: birthdays.map(
      (r): Birthday => ({ id: r.id, name: r.name, month: r.month, dayOfMonth: r.day_of_month, birthYear: r.birth_year }),
    ),
    wishes: wishes.map((r): Wish => ({ birthdayId: r.birthday_id, year: r.year, wishedOn: r.wished_on })),
  };
}

/**
 * Replace the stored data with `snapshot` in one transaction on the shared connection. The data set is a
 * person's own to-do list, so rewriting it is cheap and keeps deletes simple. Saves run one
 * after another, in the order they were asked for, so a slow write never lands after a newer one.
 */
export function saveSnapshot(db: SQLite.SQLiteDatabase, snapshot: Snapshot): Promise<void> {
  return exclusive(() => writeSnapshot(db, snapshot));
}

async function writeSnapshot(db: SQLite.SQLiteDatabase, snapshot: Snapshot): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tasks');
    await db.runAsync('DELETE FROM day_entries');
    await db.runAsync('DELETE FROM birthdays');
    await db.runAsync('DELETE FROM wishes');
    for (const t of snapshot.plan.tasks) {
      await db.runAsync('INSERT INTO tasks (id, title, day, time, sort_order, slips, done_on, notes, repeat, repeat_every, repeat_from, series) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        t.id,
        t.title,
        t.day,
        t.time,
        t.order,
        t.slips,
        t.doneOn,
        t.notes,
        t.repeat,
        t.every,
        t.repeatFrom,
        t.series,
      ]);
    }
    for (const e of snapshot.plan.entries) {
      await db.runAsync('INSERT INTO day_entries (task_id, day, outcome) VALUES (?, ?, ?)', [e.taskId, e.day, e.outcome]);
    }
    for (const b of snapshot.birthdays) {
      await db.runAsync('INSERT INTO birthdays (id, name, month, day_of_month, birth_year) VALUES (?, ?, ?, ?, ?)', [
        b.id,
        b.name,
        b.month,
        b.dayOfMonth,
        b.birthYear,
      ]);
    }
    for (const w of snapshot.wishes) {
      await db.runAsync('INSERT INTO wishes (birthday_id, year, wished_on) VALUES (?, ?, ?)', [w.birthdayId, w.year, w.wishedOn]);
    }
  });
}
