import type { SQLiteDatabase } from 'expo-sqlite';

import type { Example } from '../domain/naive-bayes';

import type { Repo, StoredMessage, Suggestion, SuggestionStatus } from './ingest';

export const WHATSAPP_SCHEMA = `
CREATE TABLE IF NOT EXISTS chats (
  name TEXT PRIMARY KEY NOT NULL,
  is_group INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat TEXT NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_chat_seen ON messages (chat, seen_at);
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  chat TEXT NOT NULL,
  sender TEXT NOT NULL,
  snippet TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  day TEXT,
  time TEXT,
  name TEXT,
  approximate INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

type SuggestionRow = {
  id: string;
  kind: 'deadline' | 'birthday';
  chat: string;
  sender: string;
  snippet: string;
  sent_at: number;
  day: string | null;
  time: string | null;
  name: string | null;
  approximate: number;
  score: number;
  status: SuggestionStatus;
  created_at: number;
};

const toSuggestion = (r: SuggestionRow): Suggestion => ({
  id: r.id,
  kind: r.kind,
  chat: r.chat,
  sender: r.sender,
  snippet: r.snippet,
  sentAt: r.sent_at,
  day: r.day,
  time: r.time,
  name: r.name,
  approximate: r.approximate === 1,
  score: r.score,
  status: r.status,
  createdAt: r.created_at,
});

export type ChatRow = { name: string; isGroup: boolean; enabled: boolean; lastSeen: number };

/** Default number of days scanned message text is kept. */
export const DEFAULT_RETENTION_DAYS = 14;

export function createRepo(db: SQLiteDatabase): Repo {
  return {
    async touchChat(name, isGroup, now) {
      await db.runAsync(
        'INSERT INTO chats (name, is_group, enabled, last_seen) VALUES (?, ?, 1, ?) ON CONFLICT(name) DO UPDATE SET last_seen = excluded.last_seen, is_group = excluded.is_group',
        [name, isGroup ? 1 : 0, now],
      );
      const row = await db.getFirstAsync<{ enabled: number }>('SELECT enabled FROM chats WHERE name = ?', [name]);
      return { enabled: row?.enabled === 1 };
    },
    async recentMessages(chat, since) {
      const rows = await db.getAllAsync<{ chat: string; sender: string; text: string; seen_at: number }>(
        'SELECT chat, sender, text, seen_at FROM messages WHERE chat = ? AND seen_at >= ?',
        [chat, since],
      );
      return rows.map((r): StoredMessage => ({ chat: r.chat, sender: r.sender, text: r.text, seenAt: r.seen_at }));
    },
    async addMessage(m) {
      await db.runAsync('INSERT INTO messages (chat, sender, text, sent_at, seen_at) VALUES (?, ?, ?, ?, ?)', [m.chat, m.sender, m.text, m.sentAt, m.seenAt]);
    },
    async participants(chat) {
      const rows = await db.getAllAsync<{ sender: string }>('SELECT DISTINCT sender FROM messages WHERE chat = ?', [chat]);
      return rows.map((r) => r.sender);
    },
    async addSuggestion(s) {
      const existing =
        s.kind === 'birthday'
          ? await db.getFirstAsync('SELECT id FROM suggestions WHERE kind = ? AND chat = ? AND name IS ? AND day IS ?', [s.kind, s.chat, s.name, s.day])
          : await db.getFirstAsync('SELECT id FROM suggestions WHERE kind = ? AND chat = ? AND snippet = ?', [s.kind, s.chat, s.snippet]);
      if (existing) return false;
      await db.runAsync(
        'INSERT INTO suggestions (id, kind, chat, sender, snippet, sent_at, day, time, name, approximate, score, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.kind, s.chat, s.sender, s.snippet, s.sentAt, s.day, s.time, s.name, s.approximate ? 1 : 0, s.score, s.status, s.createdAt],
      );
      return true;
    },
    async setMeta(key, value) {
      await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    },
    async examples() {
      return loadExamples(db);
    },
  };
}

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function pendingSuggestions(db: SQLiteDatabase): Promise<Suggestion[]> {
  const rows = await db.getAllAsync<SuggestionRow>("SELECT * FROM suggestions WHERE status = 'pending' ORDER BY sent_at DESC");
  return rows.map(toSuggestion);
}

export async function setSuggestionStatus(db: SQLiteDatabase, id: string, status: SuggestionStatus): Promise<void> {
  await db.runAsync('UPDATE suggestions SET status = ? WHERE id = ?', [status, id]);
}

export async function listChats(db: SQLiteDatabase): Promise<ChatRow[]> {
  const rows = await db.getAllAsync<{ name: string; is_group: number; enabled: number; last_seen: number }>('SELECT * FROM chats ORDER BY last_seen DESC');
  return rows.map((r) => ({ name: r.name, isGroup: r.is_group === 1, enabled: r.enabled === 1, lastSeen: r.last_seen }));
}

export async function setChatEnabled(db: SQLiteDatabase, name: string, enabled: boolean): Promise<void> {
  await db.runAsync('UPDATE chats SET enabled = ? WHERE name = ?', [enabled ? 1 : 0, name]);
  if (!enabled) await db.runAsync("UPDATE suggestions SET status = 'dismissed' WHERE chat = ? AND status = 'pending'", [name]);
}

/** Delete scanned message text older than the retention period. Suggestions keep only their short snippet. */
export async function purgeOldMessages(db: SQLiteDatabase, now: number, retentionDays: number): Promise<void> {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  await db.runAsync('DELETE FROM messages WHERE seen_at < ?', [cutoff]);
}

export async function retentionDays(db: SQLiteDatabase): Promise<number> {
  const v = await getMeta(db, 'retention_days');
  const n = v === null ? DEFAULT_RETENTION_DAYS : Number(v);
  return Number.isFinite(n) ? n : DEFAULT_RETENTION_DAYS;
}

/** Save how long scanned text is kept and delete anything already older than that. */
export async function setRetentionDays(db: SQLiteDatabase, days: number): Promise<void> {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', ['retention_days', String(days)]);
  await purgeOldMessages(db, Date.now(), days);
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

const MAX_EXAMPLES = 1000;

/** What the user has taught the model, newest last. Only the latest few hundred matter, so older ones are left out. */
export async function loadExamples(db: SQLiteDatabase): Promise<Example[]> {
  const rows = await db.getAllAsync<{ text: string; label: 'yes' | 'no' }>(
    'SELECT text, label FROM (SELECT id, text, label FROM examples ORDER BY id DESC LIMIT ?) ORDER BY id ASC',
    [MAX_EXAMPLES],
  );
  return rows.map((r) => ({ text: r.text, label: r.label }));
}

/** Remember a tap: the message text and whether the user wanted it. */
export async function addExample(db: SQLiteDatabase, text: string, label: 'yes' | 'no'): Promise<void> {
  await db.runAsync('INSERT INTO examples (text, label, created_at) VALUES (?, ?, ?)', [text, label, Date.now()]);
}

export type RecentMessage = { id: number; chat: string; sender: string; text: string; sentAt: number };

/** The newest scanned messages, newest first. */
export async function recentMessageList(db: SQLiteDatabase, limit: number): Promise<RecentMessage[]> {
  const rows = await db.getAllAsync<{ id: number; chat: string; sender: string; text: string; sent_at: number }>(
    'SELECT id, chat, sender, text, sent_at FROM messages ORDER BY seen_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({ id: r.id, chat: r.chat, sender: r.sender, text: r.text, sentAt: r.sent_at }));
}
