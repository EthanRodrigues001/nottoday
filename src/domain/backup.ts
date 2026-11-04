import type { Birthday, Wish } from './birthdays.ts';
import { isValidDay, isValidTime } from './dates.ts';
import type { DayEntry, Outcome, Plan, Task } from './planner.ts';
import { isRepeat, normalizeEvery } from './repeat.ts';

export type BackupData = { plan: Plan; birthdays: Birthday[]; wishes: Wish[] };

const APP = 'nottoday';
const VERSION = 1;
const OUTCOMES: readonly string[] = ['planned', 'done', 'slipped', 'moved'];

/** The user's tasks, history, birthdays and wishes as text they can keep. WhatsApp data is not included. */
export function serializeBackup(data: BackupData, exportedAt: Date): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: exportedAt.toISOString(), data }, null, 2);
}

export type BackupResult = { ok: true; data: BackupData } | { ok: false; error: string };

const fail = (error: string): BackupResult => ({ ok: false, error });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is string => typeof v === 'string' && isValidDay(v);

/** Read a backup and check every field, so a damaged or foreign file cannot corrupt the app's data. */
export function parseBackup(text: string): BackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('This file is not a backup (it is not valid JSON).');
  }
  if (!isObject(raw) || raw.app !== APP) return fail('This file is not a notToday backup.');
  if (raw.version !== VERSION) return fail('This backup was made by a different version of the app.');
  const data = raw.data;
  if (!isObject(data) || !isObject(data.plan)) return fail('The backup is missing its data.');
  const { tasks, entries } = data.plan;
  if (!Array.isArray(tasks) || !Array.isArray(entries) || !Array.isArray(data.birthdays) || !Array.isArray(data.wishes)) {
    return fail('The backup is incomplete.');
  }

  const taskList: Task[] = [];
  const ids = new Set<string>();
  for (const t of tasks) {
    if (!isObject(t) || typeof t.id !== 'string' || typeof t.title !== 'string' || ids.has(t.id)) return fail('A task in the backup is damaged.');
    if (!(t.day === null || isDay(t.day)) || !(t.doneOn === null || isDay(t.doneOn))) return fail('A task in the backup has a bad date.');
    if (!(t.time === null || (typeof t.time === 'string' && isValidTime(t.time)))) return fail('A task in the backup has a bad time.');
    if (typeof t.order !== 'number' || typeof t.slips !== 'number') return fail('A task in the backup is damaged.');
    ids.add(t.id);
    taskList.push({ id: t.id, title: t.title, day: t.day, time: t.time, order: t.order, slips: t.slips, doneOn: t.doneOn,
      // Backups made before notes and repeats existed lack these; they come back as plain tasks.
      notes: typeof t.notes === 'string' ? t.notes : '',
      repeat: isRepeat(t.repeat) && t.day !== null ? t.repeat : 'none',
      every: isRepeat(t.repeat) && t.repeat !== 'none' ? normalizeEvery(t.every) : 1,
      repeatFrom: isRepeat(t.repeat) && t.repeat !== 'none' && typeof t.repeatFrom === 'string' && isDay(t.repeatFrom) ? t.repeatFrom : null,
      series: isRepeat(t.repeat) && t.repeat !== 'none' && typeof t.series === 'string' ? t.series : null,
    });
  }

  const entryList: DayEntry[] = [];
  for (const e of entries) {
    if (!isObject(e) || typeof e.taskId !== 'string' || !isDay(e.day) || typeof e.outcome !== 'string' || !OUTCOMES.includes(e.outcome)) {
      return fail('A history entry in the backup is damaged.');
    }
    if (ids.has(e.taskId)) entryList.push({ taskId: e.taskId, day: e.day, outcome: e.outcome as Outcome });
  }

  const birthdayList: Birthday[] = [];
  const birthdayIds = new Set<string>();
  for (const b of data.birthdays) {
    if (!isObject(b) || typeof b.id !== 'string' || typeof b.name !== 'string' || birthdayIds.has(b.id)) return fail('A birthday in the backup is damaged.');
    if (!Number.isInteger(b.month) || !Number.isInteger(b.dayOfMonth) || (b.month as number) < 1 || (b.month as number) > 12 || (b.dayOfMonth as number) < 1 || (b.dayOfMonth as number) > 31) {
      return fail('A birthday in the backup has a bad date.');
    }
    if (!(b.birthYear === null || Number.isInteger(b.birthYear))) return fail('A birthday in the backup is damaged.');
    birthdayIds.add(b.id);
    birthdayList.push({ id: b.id, name: b.name, month: b.month as number, dayOfMonth: b.dayOfMonth as number, birthYear: b.birthYear as number | null });
  }

  const wishList: Wish[] = [];
  for (const w of data.wishes) {
    if (!isObject(w) || typeof w.birthdayId !== 'string' || !Number.isInteger(w.year) || !isDay(w.wishedOn)) return fail('A wish in the backup is damaged.');
    if (birthdayIds.has(w.birthdayId)) wishList.push({ birthdayId: w.birthdayId, year: w.year as number, wishedOn: w.wishedOn });
  }

  return { ok: true, data: { plan: { tasks: taskList, entries: entryList }, birthdays: birthdayList, wishes: wishList } };
}
