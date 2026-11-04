import type { SQLiteDatabase } from 'expo-sqlite';

import { drainQueue } from '@modules/whatsapp-listener/src';

import { ingestNotification } from './ingest';
import { parseQueueLine } from './queue';
import { createRepo, purgeOldMessages, retentionDays } from './repository';

let lastPurge = 0;

/**
 * Take the WhatsApp notifications the background service has kept, run them through the same pipeline
 * (parse, skip repeats and switched-off chats, look for deadlines and birthdays), and clean out old text.
 * Returns how many notifications were read.
 */
export async function drainAndIngest(db: SQLiteDatabase): Promise<number> {
  const lines = await drainQueue();
  const repo = createRepo(db);
  for (const line of lines) {
    const queued = parseQueueLine(line);
    if (!queued) continue;
    try {
      await ingestNotification(repo, queued.raw, queued.seenAt);
    } catch (error) {
      // Never log the message itself.
      console.warn('Reading a WhatsApp notification failed', error instanceof Error ? error.message : 'unknown error');
    }
  }
  const now = Date.now();
  if (now - lastPurge > 60 * 60 * 1000) {
    lastPurge = now;
    await purgeOldMessages(db, now, await retentionDays(db));
  }
  return lines.length;
}
