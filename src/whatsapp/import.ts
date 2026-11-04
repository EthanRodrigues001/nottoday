import { classifyDeadline, findBirthdayWish } from '../domain/classifier.ts';
import type { ParsedExport } from '../domain/chat-export.ts';
import { toDay, type Day } from '../domain/dates.ts';
import { isUsable, predict, train } from '../domain/naive-bayes.ts';

import { MODEL_SUPPRESS_BELOW, type Repo, type Suggestion } from './ingest.ts';

export type ImportOptions = {
  /** The chat's name: the person for a one-to-one chat, the group name otherwise. */
  chat: string;
  /** Names the user appears under in this chat. Their messages are where sent birthday wishes come from. */
  me: readonly string[];
  today: Day;
  now: number;
  /** True when a birthday for this person and day is already saved. */
  knowsBirthday: (name: string, month: number, dayOfMonth: number) => boolean;
};

export type ImportSummary = {
  messages: number;
  deadlines: number;
  birthdays: number;
  /** Wishes sent in a group where the person could not be named. They are skipped, not guessed. */
  unnamedWishes: number;
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const SNIPPET_LENGTH = 220;
const snippetOf = (text: string) => (text.length > SNIPPET_LENGTH ? `${text.slice(0, SNIPPET_LENGTH - 1)}…` : text);

/**
 * Turn an exported chat into Inbox suggestions. The history is never stored and never trains the model.
 * Only deadlines that are still ahead are suggested (older ones are over), and each person's birthday is
 * suggested once however many years of wishes the chat holds.
 */
export async function importChat(
  repo: Pick<Repo, 'addSuggestion' | 'examples'>,
  parsed: ParsedExport,
  options: ImportOptions,
): Promise<ImportSummary> {
  const mine = new Set(options.me.map((n) => n.toLowerCase()));
  const others = parsed.participants.filter((p) => !mine.has(p.toLowerCase()));
  const isGroup = others.length > 1;
  const taught = train(await repo.examples());
  const modelOn = isUsable(taught);

  const summary: ImportSummary = { messages: parsed.messages.length, deadlines: 0, birthdays: 0, unnamedWishes: 0 };
  const birthdaysSeen = new Set<string>();

  const suggestBirthday = async (name: string, sentAt: Date, sender: string, text: string, belated: boolean) => {
    const month = sentAt.getMonth() + 1;
    const dayOfMonth = sentAt.getDate();
    const key = `${name.toLowerCase()}|${month}-${dayOfMonth}`;
    if (birthdaysSeen.has(key) || options.knowsBirthday(name, month, dayOfMonth)) return;
    birthdaysSeen.add(key);
    const s: Suggestion = {
      id: newId(),
      kind: 'birthday',
      chat: options.chat,
      sender,
      snippet: snippetOf(text),
      sentAt: sentAt.getTime(),
      day: toDay(sentAt),
      time: null,
      name,
      approximate: belated,
      score: 0.9,
      status: 'pending',
      createdAt: options.now,
    };
    if (await repo.addSuggestion(s)) summary.birthdays++;
  };

  for (const m of parsed.messages) {
    if (mine.has(m.sender.toLowerCase())) {
      // The user's own wishes: in a one-to-one chat the other person is who was wished.
      const wish = findBirthdayWish(m.text, others);
      if (!wish) continue;
      const name = wish.name ?? (isGroup ? null : (others[0] ?? options.chat));
      if (!name) {
        summary.unnamedWishes++;
        continue;
      }
      await suggestBirthday(name, m.sentAt, m.sender, m.text, wish.belated);
      continue;
    }

    // Someone else's message: a deadline still to come, or (in a group) a wish for another person.
    const verdict = classifyDeadline(m.text, m.sentAt);
    if (verdict.isDeadline && verdict.date && verdict.date.day >= options.today) {
      if (!modelOn || predict(taught, m.text) >= MODEL_SUPPRESS_BELOW) {
        const added = await repo.addSuggestion({
          id: newId(),
          kind: 'deadline',
          chat: options.chat,
          sender: m.sender,
          snippet: snippetOf(m.text),
          sentAt: m.sentAt.getTime(),
          day: verdict.date.day,
          time: verdict.date.time,
          name: null,
          approximate: verdict.date.approximate,
          score: verdict.score,
          status: 'pending',
          createdAt: options.now,
        });
        if (added) summary.deadlines++;
      }
    }
    if (isGroup) {
      const wish = findBirthdayWish(m.text, others.filter((o) => o !== m.sender));
      if (wish?.name) await suggestBirthday(wish.name, m.sentAt, m.sender, m.text, wish.belated);
    }
  }
  return summary;
}
