import { classifyDeadline, findBirthdayWish } from '../domain/classifier.ts';
import { toDay, type Day, type TimeOfDay } from '../domain/dates.ts';
import { isUsable, predict, train, type Example } from '../domain/naive-bayes.ts';
import { isRepeat, parseWhatsAppNotification, type RawNotification } from '../domain/whatsapp.ts';

export type SuggestionKind = 'deadline' | 'birthday';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  chat: string;
  sender: string;
  /** The message text, cut to a card-sized snippet. */
  snippet: string;
  sentAt: number;
  /** Proposed due day (deadline) or the day the wish was sent (birthday). Null means Someday. */
  day: Day | null;
  time: TimeOfDay | null;
  /** Person being wished, for a birthday. Null when the message did not say. */
  name: string | null;
  /** The date came from a fuzzy phrase, so the card asks the user to check it. */
  approximate: boolean;
  score: number;
  status: SuggestionStatus;
  createdAt: number;
};

export type StoredMessage = { chat: string; sender: string; text: string; seenAt: number };

/** Everything ingest needs from storage, so it can run against SQLite or an in-memory fake. */
export interface Repo {
  /** Records a chat (new chats are on) and returns whether scanning is on for it. */
  touchChat(name: string, isGroup: boolean, now: number): Promise<{ enabled: boolean }>;
  recentMessages(chat: string, since: number): Promise<StoredMessage[]>;
  addMessage(m: StoredMessage & { sentAt: number }): Promise<void>;
  participants(chat: string): Promise<string[]>;
  /** Stores a suggestion unless an equal one (same kind, chat and snippet, or same birthday) exists. Returns whether it was new. */
  addSuggestion(s: Suggestion): Promise<boolean>;
  setMeta(key: string, value: string): Promise<void>;
  /** Everything the user has taught the model so far (Add, Dismiss, marked as missed). */
  examples(): Promise<Example[]>;
}

/** With the model sure a message is not wanted, a rule match is held back. */
export const MODEL_SUPPRESS_BELOW = 0.08;
/** With the model sure a message is wanted, a message the rules only half liked is suggested. */
export const MODEL_PROMOTE_FROM = 0.92;
/** The rules must still find at least a hint before the model alone may suggest something. */
const MODEL_PROMOTE_MIN_RULE_SCORE = 0.3;

export type IngestOutcome =
  | { kind: 'ignored'; reason: string }
  | { kind: 'stored'; suggestions: Suggestion['kind'][] };

const SNIPPET_LENGTH = 220;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const snippetOf = (text: string) => (text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 1)}…` : text);

/**
 * One WhatsApp notification in, zero or more suggestions out. Anything that is not WhatsApp is dropped
 * before its text is looked at, and message text is never logged.
 */
export async function ingestNotification(repo: Repo, raw: RawNotification, now: number): Promise<IngestOutcome> {
  const parsed = parseWhatsAppNotification(raw);
  if (parsed.kind === 'ignored') return { kind: 'ignored', reason: parsed.reason };
  const { message } = parsed;

  await repo.setMeta('last_message_at', String(now));
  const { enabled } = await repo.touchChat(message.chat, message.isGroup, now);
  if (!enabled) return { kind: 'ignored', reason: 'chat switched off' };

  const recent = await repo.recentMessages(message.chat, now - 10 * 60 * 1000);
  if (isRepeat(recent, message, now)) return { kind: 'ignored', reason: 'repeat' };
  await repo.addMessage({ chat: message.chat, sender: message.sender, text: message.text, seenAt: now, sentAt: message.sentAt.getTime() });

  const made: Suggestion['kind'][] = [];
  const base = {
    chat: message.chat,
    sender: message.sender,
    snippet: snippetOf(message.text),
    sentAt: message.sentAt.getTime(),
    status: 'pending' as const,
    createdAt: now,
  };

  const verdict = classifyDeadline(message.text, message.sentAt);
  let isDeadline = verdict.isDeadline;
  let score = verdict.score;
  const taught = train(await repo.examples());
  if (isUsable(taught)) {
    const p = predict(taught, message.text);
    if (isDeadline && p < MODEL_SUPPRESS_BELOW) isDeadline = false;
    else if (!isDeadline && p >= MODEL_PROMOTE_FROM && verdict.score >= MODEL_PROMOTE_MIN_RULE_SCORE) {
      isDeadline = true;
      score = p;
    }
  }
  if (isDeadline) {
    const added = await repo.addSuggestion({
      ...base,
      id: newId(),
      kind: 'deadline',
      day: verdict.date?.day ?? null,
      time: verdict.date?.time ?? null,
      name: null,
      approximate: verdict.date?.approximate ?? false,
      score,
    });
    if (added) made.push('deadline');
  }

  // In a one-to-one chat an incoming wish is for the user's own birthday, so only groups can name someone else.
  if (message.isGroup) {
    const wish = findBirthdayWish(message.text, await repo.participants(message.chat));
    if (wish) {
      const added = await repo.addSuggestion({
        ...base,
        id: newId(),
        kind: 'birthday',
        day: toDay(message.sentAt),
        time: null,
        name: wish.name,
        approximate: wish.belated,
        score: wish.name ? 0.9 : 0.5,
      });
      if (added) made.push('birthday');
    }
  }
  return { kind: 'stored', suggestions: made };
}
