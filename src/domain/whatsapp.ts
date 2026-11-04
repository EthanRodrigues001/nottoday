/**
 * Turns an Android notification from WhatsApp into one chat message.
 *
 * WhatsApp's notification layout changes between versions, so this reads several fields and
 * falls back through them. The exact shapes on the user's phone still have to be confirmed
 * with real messages (the Inbox card shows the chat and sender it parsed).
 */

export const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'] as const;

export type RawNotification = {
  packageName: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  subText?: string | null;
  timestamp: number;
  ongoing?: boolean;
  category?: string | null;
  extras?: Record<string, string | number | boolean | null | undefined>;
};

export type IncomingMessage = {
  /** Conversation name: the person for a one-to-one chat, the group name for a group. */
  chat: string;
  /** Who wrote it. Equals `chat` for one-to-one chats. */
  sender: string;
  text: string;
  sentAt: Date;
  isGroup: boolean;
};

export type ParseResult = { kind: 'message'; message: IncomingMessage } | { kind: 'ignored'; reason: string };

const ignored = (reason: string): ParseResult => ({ kind: 'ignored', reason });

const SUMMARY = /^\d+\s+new\s+messages?(?:\s+from\s+\d+\s+chats?)?$/i;
const COUNT_SUFFIX = /\s*\(\d+\s+messages?\)\s*$/i;
const DELETED = /^(?:this message was deleted|you deleted this message|message deleted|🚫\s*this message was deleted)/i;
const REACTION = /^reacted\s+.+\s+to\s+/i;
const MEDIA_ONLY = /^(?:[📷🎥🎤🎵🎧📄📍🖼📎🎬]\s*)?(?:photo|video|voice message|audio|document|sticker|gif|location|contact|image)(?:\s*\(\d+\))?$/iu;
const CHECKING = /^(?:checking for new messages|waiting for this message)/i;

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/[‎‏‪-‮]/g, '').trim();
}

export function parseWhatsAppNotification(n: RawNotification): ParseResult {
  if (!(WHATSAPP_PACKAGES as readonly string[]).includes(n.packageName)) return ignored('not WhatsApp');
  if (n.ongoing) return ignored('ongoing');
  if (n.category && n.category !== 'msg') return ignored(`category ${n.category}`);

  const extras = n.extras ?? {};
  const title = clean(n.title) || clean(String(extras['android.title'] ?? ''));
  const body = clean(n.bigText) || clean(n.text) || clean(String(extras['android.text'] ?? ''));
  if (!title || !body) return ignored('empty');
  if (title.toLowerCase() === 'whatsapp' || SUMMARY.test(body) || SUMMARY.test(title)) return ignored('summary');
  if (CHECKING.test(body)) return ignored('placeholder');
  if (DELETED.test(body)) return ignored('deleted');
  if (REACTION.test(body)) return ignored('reaction');
  if (MEDIA_ONLY.test(body)) return ignored('media only');

  const conversationTitle = clean(typeof extras['android.conversationTitle'] === 'string' ? (extras['android.conversationTitle'] as string) : '');
  const flaggedGroup = extras['android.isGroupConversation'] === true;
  const sentAt = new Date(n.timestamp);

  const stripCount = (s: string) => s.replace(COUNT_SUFFIX, '').trim();
  const senderPrefix = body.match(/^([^:\n]{1,40}):\s+([\s\S]+)$/);

  // Group chat, as reported by Android: the conversation title is the group.
  if (flaggedGroup || conversationTitle) {
    const chat = stripCount(conversationTitle || title);
    let sender = title !== chat ? stripCount(title) : '';
    let text = body;
    if (!sender && senderPrefix) {
      sender = senderPrefix[1].trim();
      text = senderPrefix[2].trim();
    } else if (sender && senderPrefix && senderPrefix[1].trim() === sender) {
      text = senderPrefix[2].trim();
    }
    // "Group: Sender" in the title itself.
    if (!sender) {
      const split = title.match(/^(.+?):\s+(.+)$/);
      if (split) {
        sender = split[2].trim();
      }
    }
    return { kind: 'message', message: { chat, sender: sender || 'Someone', text, sentAt, isGroup: true } };
  }

  // Not flagged: the title is the chat. A "Name: message" body in a chat whose title is not that name is a group.
  const chat = stripCount(title);
  if (senderPrefix && senderPrefix[1].trim().toLowerCase() !== chat.toLowerCase() && looksLikeName(senderPrefix[1])) {
    return { kind: 'message', message: { chat, sender: senderPrefix[1].trim(), text: senderPrefix[2].trim(), sentAt, isGroup: true } };
  }
  return { kind: 'message', message: { chat, sender: chat, text: body, sentAt, isGroup: false } };
}

/** One to three words, no digits-only or sentence punctuation: "Rahul", "Mrs. Rao", "Dr Sharma". */
function looksLikeName(value: string): boolean {
  const v = value.trim();
  if (v.length < 2 || v.length > 30) return false;
  if (/[?!,;]/.test(v)) return false;
  const words = v.split(/\s+/);
  return words.length <= 3 && !words.every((w) => /^\d+$/.test(w));
}

/**
 * WhatsApp re-posts a notification when it updates (for example when more messages arrive in the chat),
 * so the same message can reach us more than once. A message counts as a repeat when the same chat, sender
 * and text were seen within the window.
 */
export function isRepeat(
  recent: readonly { chat: string; sender: string; text: string; seenAt: number }[],
  message: IncomingMessage,
  now: number,
  windowMs = 10 * 60 * 1000,
): boolean {
  return recent.some((r) => r.chat === message.chat && r.sender === message.sender && r.text === message.text && now - r.seenAt <= windowMs);
}
