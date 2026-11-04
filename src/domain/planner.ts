import { addDays, daysBetween, type Day, type TimeOfDay } from './dates.ts';
import { nextAfter, normalizeEvery, type Repeat } from './repeat.ts';

export type Task = {
  id: string;
  title: string;
  /** Due day, or null when the task is in Someday. */
  day: Day | null;
  time: TimeOfDay | null;
  /** Position among the tasks of its day; lower comes first. */
  order: number;
  /** Days this task was due and not done. */
  slips: number;
  /** Day the task was ticked off, or null while open. */
  doneOn: Day | null;
  /** Free text the user attached to the task. */
  notes: string;
  /** How the task comes back once it is done. */
  repeat: Repeat;
  /** Gap between occurrences in units of `repeat`: 1 is every day/week/..., 3 is every third. */
  every: number;
  /** The first day of a repeating task. Every later day is counted from it, so the 31st does not drift. */
  repeatFrom: Day | null;
  /** Shared by every occurrence of one repeating task, so finishing one can be told from starting another. */
  series: string | null;
};

/** What happened to a task on one day. Rings and history are computed from these. */
export type Outcome = 'planned' | 'done' | 'slipped' | 'moved';

export type DayEntry = { taskId: string; day: Day; outcome: Outcome };

export type Plan = { tasks: Task[]; entries: DayEntry[] };

/** Slip count at which a task is flagged for a decision. */
export const SLIP_FLAG_AT = 3;

const keyOf = (taskId: string, day: Day) => `${taskId}|${day}`;

function setEntry(entries: Map<string, DayEntry>, taskId: string, day: Day, outcome: Outcome) {
  entries.set(keyOf(taskId, day), { taskId, day, outcome });
}

function toMap(entries: DayEntry[]): Map<string, DayEntry> {
  return new Map(entries.map((e) => [keyOf(e.taskId, e.day), e]));
}

/**
 * Move every open task that was due before `today` onto `today`, giving it one
 * Slip for each day it was due and not done. Runs when the app opens, so no
 * background job is needed at midnight.
 */
export function rollOver(plan: Plan, today: Day): Plan {
  const entries = toMap(plan.entries);
  const tasks = plan.tasks.map((task) => {
    if (task.doneOn !== null || task.day === null || task.day >= today) return task;
    const missed = daysBetween(task.day, today);
    for (let i = 0; i < missed; i++) setEntry(entries, task.id, addDays(task.day, i), 'slipped');
    setEntry(entries, task.id, today, 'planned');
    return { ...task, day: today, slips: task.slips + missed };
  });
  return { tasks, entries: [...entries.values()] };
}

export function createTask(
  plan: Plan,
  input: {
    id: string;
    title: string;
    day: Day | null;
    time?: TimeOfDay | null;
    notes?: string;
    repeat?: Repeat;
    every?: number;
    repeatFrom?: Day | null;
    series?: string | null;
  },
): Plan {
  // A task with no day cannot repeat.
  const repeat: Repeat = input.day === null ? 'none' : (input.repeat ?? 'none');
  const siblings = plan.tasks.filter((t) => t.day === input.day && t.doneOn === null);
  const order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;
  const task: Task = {
    id: input.id,
    title: input.title.trim(),
    day: input.day,
    time: input.time ?? null,
    order,
    slips: 0,
    doneOn: null,
    notes: input.notes?.trim() ?? '',
    repeat,
    every: repeat === 'none' ? 1 : normalizeEvery(input.every),
    repeatFrom: repeat === 'none' ? null : (input.repeatFrom ?? input.day),
    series: repeat === 'none' ? null : (input.series ?? input.id),
  };
  const entries = input.day === null ? plan.entries : [...plan.entries, { taskId: task.id, day: input.day, outcome: 'planned' as const }];
  return { tasks: [...plan.tasks, task], entries };
}

/**
 * Tick a task off. A repeating task also gets its next occurrence, on the first day after today (or after its
 * own day, when it was ticked early) that the repeat falls on. `nextId` names that new task; without it nothing is added.
 */
export function completeTask(plan: Plan, taskId: string, today: Day, nextId?: string): Plan {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task || task.doneOn !== null) return plan;
  const entries = toMap(plan.entries);
  if (task.day !== null) setEntry(entries, task.id, task.day, 'done');
  const done: Plan = {
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, doneOn: today } : t)),
    entries: [...entries.values()],
  };
  const comesBack =
    nextId !== undefined &&
    task.repeat !== 'none' &&
    task.repeatFrom !== null &&
    task.day !== null &&
    !plan.tasks.some((t) => t.series === task.series && t.doneOn === null && t.id !== taskId);
  if (!comesBack) return done;
  const day = nextAfter(task.repeatFrom!, task.repeat as Exclude<Repeat, 'none'>, task.day! > today ? task.day! : today, task.every);
  return createTask(done, {
    id: nextId,
    title: task.title,
    day,
    time: task.time,
    notes: task.notes,
    repeat: task.repeat,
    every: task.every,
    repeatFrom: task.repeatFrom,
    series: task.series,
  });
}

/** Undo a completion. The next occurrence that finishing a repeating task created is taken away again. */
export function reopenTask(plan: Plan, taskId: string): Plan {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task || task.doneOn === null) return plan;
  const entries = toMap(plan.entries);
  if (task.day !== null) setEntry(entries, task.id, task.day, 'planned');
  const comingNext = (t: Task) => task.series !== null && t.series === task.series && t.id !== taskId && t.doneOn === null;
  const dropped = new Set(plan.tasks.filter(comingNext).map((t) => t.id));
  return {
    tasks: plan.tasks.filter((t) => !dropped.has(t.id)).map((t) => (t.id === taskId ? { ...t, doneOn: null } : t)),
    entries: [...entries.values()].filter((e) => !dropped.has(e.taskId)),
  };
}

/** "Not today": move a task to another day, or to Someday with `null`. Slips are kept. */
export function deferTask(plan: Plan, taskId: string, to: Day | null): Plan {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task || task.doneOn !== null || task.day === to) return plan;
  const entries = toMap(plan.entries);
  if (task.day !== null) setEntry(entries, task.id, task.day, 'moved');
  if (to !== null) setEntry(entries, task.id, to, 'planned');
  const order =
    plan.tasks.filter((t) => t.day === to && t.doneOn === null).reduce((max, t) => Math.max(max, t.order), -1) + 1;
  return {
    tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, day: to, order } : t)),
    entries: [...entries.values()],
  };
}

/**
 * Change what a task says, when it is due, or its time. A new day behaves like "Not today": the old day is
 * marked moved and the task goes to the end of the new day's list. Done tasks keep their day.
 */
export function editTask(
  plan: Plan,
  taskId: string,
  changes: { title?: string; notes?: string; time?: TimeOfDay | null; day?: Day | null; repeat?: Repeat; every?: number },
): Plan {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return plan;
  let next = plan;
  if (changes.day !== undefined && task.doneOn === null) next = deferTask(next, taskId, changes.day);
  const title = changes.title?.trim();
  const day = changes.day === undefined ? task.day : changes.day;
  // Picking a day yourself moves the whole repeat to it; "Not today" does not, so one late week leaves the schedule alone.
  const repeat: Repeat = day === null ? 'none' : (changes.repeat ?? task.repeat);
  const every = repeat === 'none' ? 1 : normalizeEvery(changes.every ?? (changes.repeat !== undefined && changes.repeat !== task.repeat ? 1 : task.every));
  const anchored =
    repeat !== 'none' && (changes.day !== undefined || changes.repeat !== undefined || changes.every !== undefined || task.repeatFrom === null);
  return {
    ...next,
    tasks: next.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            title: title ? title : t.title,
            notes: changes.notes === undefined ? t.notes : changes.notes.trim(),
            time: changes.time === undefined ? t.time : changes.time,
            repeat,
            every,
            repeatFrom: repeat === 'none' ? null : anchored ? day : t.repeatFrom,
            series: repeat === 'none' ? null : (t.series ?? t.id),
          }
        : t,
    ),
  };
}

export function deleteTask(plan: Plan, taskId: string): Plan {
  return {
    tasks: plan.tasks.filter((t) => t.id !== taskId),
    entries: plan.entries.filter((e) => e.taskId !== taskId),
  };
}

/** Open tasks of a day in the user's drag order. */
export function openTasksOn(tasks: Task[], day: Day): Task[] {
  return tasks.filter((t) => t.day === day && t.doneOn === null).sort((a, b) => a.order - b.order);
}

/** Tasks completed on a day, in drag order. */
export function doneTasksOn(tasks: Task[], day: Day): Task[] {
  return tasks.filter((t) => t.day === day && t.doneOn !== null).sort((a, b) => a.order - b.order);
}

export function somedayTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.day === null && t.doneOn === null).sort((a, b) => a.order - b.order);
}

/** Move one open task of a day to a new position and renumber the day's open tasks. */
export function reorder(tasks: Task[], day: Day, taskId: string, toIndex: number): Task[] {
  const open = openTasksOn(tasks, day);
  const from = open.findIndex((t) => t.id === taskId);
  if (from === -1) return tasks;
  const target = Math.max(0, Math.min(open.length - 1, toIndex));
  const moved = open.splice(from, 1)[0];
  open.splice(target, 0, moved);
  const newOrder = new Map(open.map((t, i) => [t.id, i]));
  return tasks.map((t) => (newOrder.has(t.id) ? { ...t, order: newOrder.get(t.id)! } : t));
}

export type DayProgress = { done: number; total: number; fraction: number; hasItems: boolean };

/** How much of a day's list was done. Tasks moved elsewhere do not count against the day. */
export function dayProgress(entries: DayEntry[], day: Day): DayProgress {
  let done = 0;
  let total = 0;
  for (const e of entries) {
    if (e.day !== day || e.outcome === 'moved') continue;
    total++;
    if (e.outcome === 'done') done++;
  }
  return { done, total, fraction: total === 0 ? 0 : done / total, hasItems: total > 0 };
}

export function needsDecision(task: Task): boolean {
  return task.doneOn === null && task.slips >= SLIP_FLAG_AT;
}
