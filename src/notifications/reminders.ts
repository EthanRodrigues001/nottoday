import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import type { Snapshot } from '@/db/database';
import { addDays, fromDay, type Day } from '@/domain/dates';
import { eveningNudge, morningDigest, type Reminder } from '@/domain/digest';

/** Local `HH:mm` times for the two daily reminders. Settings lets the user change them. */
export type ReminderTimes = { morning: string; evening: string };
export const DEFAULT_REMINDER_TIMES: ReminderTimes = { morning: '08:00', evening: '20:00' };
const DAYS_AHEAD = 7;
const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function at(day: Day, time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const d = fromDay(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function schedule(reminder: Reminder, when: Date) {
  await Notifications.scheduleNotificationAsync({
    content: { title: reminder.title, body: reminder.body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
  });
}

/** Ask for the notification permission (Android 13 and later need it). Returns whether reminders may be sent. */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily reminders',
      importance: AndroidImportance.DEFAULT,
    });
  } catch {
    // Expo Go cannot create channels; reminders only work in a development build.
    return false;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Rebuild the pending reminders from the current plan: a morning message for each of the next days,
 * and tonight's nudge only if something due today is still open. Called whenever the plan changes,
 * so the counts stay true without a background job. Android falls back to a slightly inexact alarm
 * when exact alarms are not allowed, so no special permission is needed.
 */
export async function rescheduleReminders(snapshot: Snapshot, today: Day, inboxCount: number, times: ReminderTimes): Promise<void> {
  if (!(await ensureReminderPermission())) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  const { tasks } = snapshot.plan;

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    const when = at(day, times.morning);
    if (when <= now) continue;
    const digest = morningDigest(day, today, tasks, snapshot.birthdays, snapshot.wishes, i === 0 ? inboxCount : 0);
    if (digest) await schedule(digest, when);
  }

  const evening = at(today, times.evening);
  const nudge = eveningNudge(today, tasks);
  if (nudge && evening > now) await schedule(nudge, evening);
}
