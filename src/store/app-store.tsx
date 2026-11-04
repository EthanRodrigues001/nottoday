import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_REMINDER_TIMES, rescheduleReminders, type ReminderTimes } from '@/notifications/reminders';
import { getMeta, pendingSuggestions, setMeta } from '@/whatsapp/repository';

import { emptySnapshot, loadSnapshot, openDatabase, saveSnapshot, type Snapshot } from '@/db/database';
import { clearWish, recordWish } from '@/domain/birthdays';
import { addDays, isValidTime, toDay, type Day, type TimeOfDay } from '@/domain/dates';
import type { Repeat } from '@/domain/repeat';
import { dayLabel } from '@/lib/day-label';
import {
  completeTask,
  createTask,
  deferTask,
  deleteTask,
  editTask,
  reopenTask,
  reorder,
  rollOver,
} from '@/domain/planner';

/** A short message with an Undo, shown after a gesture so nothing is destructive. */
/** What happened, so the message can show the right icon. */
export type NoticeKind = 'done' | 'moved' | 'deleted' | 'info';
export type Notice = { id: number; message: string; kind: NoticeKind };

type Store = {
  ready: boolean;
  /** The open database, for features that keep their own tables (WhatsApp scanning). Null until ready. */
  db: SQLiteDatabase | null;
  /** Whether the Today header shows the animated ASCII gradient instead of the plain one. */
  animatedHeader: boolean;
  setAnimatedHeader: (on: boolean) => void;
  /** When the morning summary and the evening nudge arrive. */
  reminderTimes: ReminderTimes;
  setReminderTimes: (times: ReminderTimes) => void;
  today: Day;
  snapshot: Snapshot;
  notice: Notice | null;
  dismissNotice: () => void;
  undo: () => void;
  addTask: (input: { title: string; day: Day | null; time?: TimeOfDay | null; notes?: string; repeat?: Repeat; every?: number }) => void;
  /** Change a task's title, notes, time or day. A new day counts as "Not today" for the old one. */
  updateTask: (taskId: string, changes: { title?: string; notes?: string; time?: TimeOfDay | null; day?: Day | null; repeat?: Repeat; every?: number }) => void;
  toggleDone: (taskId: string) => void;
  notToday: (taskId: string, to: Day | null, options?: { silent?: boolean }) => void;
  removeTask: (taskId: string) => void;
  moveTask: (taskId: string, day: Day, toIndex: number) => void;
  addBirthday: (input: { name: string; month: number; dayOfMonth: number; birthYear: number | null }) => void;
  removeBirthday: (id: string) => void;
  toggleWish: (birthdayId: string, year: number) => void;
  /** Replace all tasks, birthdays and wishes, for restoring a backup. */
  replaceAll: (data: Snapshot) => void;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore must be used inside <AppStoreProvider>');
  return store;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [today, setToday] = useState<Day>(() => toDay(new Date()));
  const [ready, setReady] = useState(false);
  const [database, setDatabase] = useState<SQLiteDatabase | null>(null);
  const [animatedHeader, setAnimatedHeaderState] = useState(true);
  const [reminderTimes, setReminderTimesState] = useState<ReminderTimes>(DEFAULT_REMINDER_TIMES);
  const [notice, setNotice] = useState<Notice | null>(null);

  const dbRef = useRef<SQLiteDatabase | null>(null);
  const snapshotRef = useRef(snapshot);
  const todayRef = useRef(today);
  const previousRef = useRef<Snapshot | null>(null);
  const noticeId = useRef(0);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  /** True once the saved data has been read. Nothing is written before that, so an empty start can never overwrite it. */
  const loadedRef = useRef(false);

  const persist = useCallback((next: Snapshot) => {
    // Saves run one after another so a slow write never lands after a newer one.
    if (!loadedRef.current) return;
    saveChain.current = saveChain.current
      .then(() => (dbRef.current ? saveSnapshot(dbRef.current, next) : undefined))
      .catch((error) => console.warn('Saving failed', error));
  }, []);

  const apply = useCallback(
    (next: Snapshot, message?: string, kind: NoticeKind = 'info') => {
      previousRef.current = message ? snapshotRef.current : null;
      snapshotRef.current = next;
      setSnapshot(next);
      persist(next);
      setNotice(message ? { id: ++noticeId.current, message, kind } : null);
    },
    [persist],
  );

  // Open the database once, then move anything left over from earlier days onto today.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await openDatabase();
      dbRef.current = db;
      const loaded = await loadSnapshot(db);
      if (cancelled) return;
      const now = toDay(new Date());
      const rolled: Snapshot = { ...loaded, plan: rollOver(loaded.plan, now) };
      snapshotRef.current = rolled;
      setSnapshot(rolled);
      todayRef.current = now;
      setToday(now);
      loadedRef.current = true;
      // Only write back if the roll-over actually changed something.
      if (JSON.stringify(rolled.plan) !== JSON.stringify(loaded.plan)) persist(rolled);
      setAnimatedHeaderState((await getMeta(db, 'animated_header')) !== '0');
      const savedTimes = await getMeta(db, 'reminder_times');
      if (savedTimes) {
        try {
          const parsed = JSON.parse(savedTimes) as Partial<ReminderTimes>;
          setReminderTimesState({
            morning: isValidTime(parsed.morning ?? '') ? parsed.morning! : DEFAULT_REMINDER_TIMES.morning,
            evening: isValidTime(parsed.evening ?? '') ? parsed.evening! : DEFAULT_REMINDER_TIMES.evening,
          });
        } catch {
          // A damaged setting falls back to the defaults.
        }
      }
      setDatabase(db);
      setReady(true);
    })().catch((error) => console.warn('Opening the database failed', error));
    return () => {
      cancelled = true;
    };
  }, [persist]);

  // When the calendar day changes, move leftover tasks onto the new day (and count their Slips).
  const syncDay = useCallback(() => {
    if (!dbRef.current) return;
    const now = toDay(new Date());
    if (now === todayRef.current) return;
    todayRef.current = now;
    const rolled: Snapshot = { ...snapshotRef.current, plan: rollOver(snapshotRef.current.plan, now) };
    snapshotRef.current = rolled;
    setSnapshot(rolled);
    persist(rolled);
    setToday(now);
  }, [persist]);

  // The app came back from the background on a new day.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state === 'active' && syncDay());
    return () => sub.remove();
  }, [syncDay]);

  // Midnight passed while the app stayed open.
  useEffect(() => {
    const next = new Date();
    next.setHours(24, 0, 1, 0);
    const timer = setTimeout(syncDay, next.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [today, syncDay]);

  // Keep tomorrow morning's and tonight's reminders true to the plan. Waits a moment so a burst of edits is one reschedule.
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      (async () => {
        const waiting = database ? (await pendingSuggestions(database)).length : 0;
        await rescheduleReminders(snapshot, today, waiting, reminderTimes);
      })().catch((error) => console.warn('Scheduling reminders failed', error));
    }, 1500);
    return () => clearTimeout(timer);
  }, [ready, database, snapshot, today, reminderTimes]);

  const store = useMemo<Store>(() => {
    const plan = () => snapshotRef.current.plan;
    const withPlan = (p: Snapshot['plan']): Snapshot => ({ ...snapshotRef.current, plan: p });
    return {
      ready,
      db: database,
      animatedHeader,
      setAnimatedHeader: (on) => {
        setAnimatedHeaderState(on);
        if (database) setMeta(database, 'animated_header', on ? '1' : '0').catch((error) => console.warn('Saving a setting failed', error));
      },
      reminderTimes,
      setReminderTimes: (times) => {
        setReminderTimesState(times);
        if (database) setMeta(database, 'reminder_times', JSON.stringify(times)).catch((error) => console.warn('Saving a setting failed', error));
      },
      today,
      snapshot,
      notice,
      dismissNotice: () => setNotice(null),
      undo: () => {
        const previous = previousRef.current;
        if (!previous) return;
        previousRef.current = null;
        snapshotRef.current = previous;
        setSnapshot(previous);
        persist(previous);
        setNotice(null);
      },
      addTask: ({ title, day, time, notes, repeat, every }) => {
        if (!title.trim()) return;
        apply(withPlan(createTask(plan(), { id: newId(), title, day, time, notes, repeat, every })));
      },
      updateTask: (taskId, changes) => apply(withPlan(editTask(plan(), taskId, changes))),
      toggleDone: (taskId) => {
        const task = plan().tasks.find((t) => t.id === taskId);
        if (!task) return;
        apply(
          withPlan(task.doneOn === null ? completeTask(plan(), taskId, today, newId()) : reopenTask(plan(), taskId)),
          task.doneOn === null ? 'Done' : undefined,
          'done',
        );
      },
      notToday: (taskId, to, options) => {
        const label = to === null ? 'Someday' : to === addDays(today, 1) ? 'tomorrow' : dayLabel(to, today);
        apply(withPlan(deferTask(plan(), taskId, to)), options?.silent ? undefined : `Moved to ${label}`, 'moved');
      },
      removeTask: (taskId) => apply(withPlan(deleteTask(plan(), taskId)), 'Deleted', 'deleted'),
      moveTask: (taskId, day, toIndex) =>
        apply(withPlan({ ...plan(), tasks: reorder(plan().tasks, day, taskId, toIndex) })),
      addBirthday: ({ name, month, dayOfMonth, birthYear }) => {
        if (!name.trim()) return;
        const birthday = { id: newId(), name: name.trim(), month, dayOfMonth, birthYear };
        apply({ ...snapshotRef.current, birthdays: [...snapshotRef.current.birthdays, birthday] });
      },
      removeBirthday: (id) =>
        apply(
          {
            ...snapshotRef.current,
            birthdays: snapshotRef.current.birthdays.filter((b) => b.id !== id),
            wishes: snapshotRef.current.wishes.filter((w) => w.birthdayId !== id),
          },
          'Birthday removed',
          'deleted',
        ),
      replaceAll: (data) => apply({ ...data, plan: rollOver(data.plan, todayRef.current) }, 'Backup restored'),
      toggleWish: (birthdayId, year) => {
        const wishes = snapshotRef.current.wishes;
        const already = wishes.some((w) => w.birthdayId === birthdayId && w.year === year);
        apply({
          ...snapshotRef.current,
          wishes: already ? clearWish(wishes, birthdayId, year) : recordWish(wishes, birthdayId, year, today),
        });
      },
    };
  }, [ready, database, animatedHeader, reminderTimes, today, snapshot, notice, apply, persist]);

  return <StoreContext value={store}>{children}</StoreContext>;
}
