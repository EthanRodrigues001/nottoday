import type { RawNotification } from '../domain/whatsapp.ts';

export type QueuedNotification = { raw: RawNotification; seenAt: number };

type Line = {
  packageName?: unknown;
  title?: unknown;
  text?: unknown;
  bigText?: unknown;
  subText?: unknown;
  timestamp?: unknown;
  seenAt?: unknown;
  ongoing?: unknown;
  category?: unknown;
  isGroupConversation?: unknown;
  conversationTitle?: unknown;
};

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** One line from the native queue to a notification the parser understands. Bad lines return null. */
export function parseQueueLine(line: string): QueuedNotification | null {
  let data: Line;
  try {
    data = JSON.parse(line) as Line;
  } catch {
    return null;
  }
  if (typeof data.packageName !== 'string' || typeof data.timestamp !== 'number') return null;
  const extras: NonNullable<RawNotification['extras']> = {};
  if (data.isGroupConversation === true) extras['android.isGroupConversation'] = true;
  const conversationTitle = str(data.conversationTitle);
  if (conversationTitle) extras['android.conversationTitle'] = conversationTitle;
  return {
    seenAt: typeof data.seenAt === 'number' ? data.seenAt : data.timestamp,
    raw: {
      packageName: data.packageName,
      title: str(data.title),
      text: str(data.text),
      bigText: str(data.bigText),
      subText: str(data.subText),
      timestamp: data.timestamp,
      ongoing: data.ongoing === true,
      category: str(data.category),
      extras,
    },
  };
}
