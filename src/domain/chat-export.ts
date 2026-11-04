/**
 * Reads the text file from WhatsApp's "Export chat" (without media).
 *
 * Android writes `31/10/2026, 11:45 pm - Name: message`, iPhone writes `[31/10/2026, 23:45:12] Name: message`,
 * and the date order, separators and 12 or 24 hour clock depend on the phone's language. A message can span
 * several lines, and lines without a sender are system notices ("Messages are end-to-end encrypted").
 */

export type ExportedMessage = { sender: string; text: string; sentAt: Date };

export type ParsedExport = {
  messages: ExportedMessage[];
  /** Everyone who wrote at least one message. */
  participants: string[];
  /** Which order the dates were written in. */
  dateOrder: 'day-first' | 'month-first';
};

// Optional invisible direction mark, optional "[", date, time (optionally with seconds and am/pm), optional "]", optional "-", rest.
const LINE =
  /^[‎‏‪-‮]*\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?::(\d{2}))?[\s  ]*([ap]\.?m\.?)?\]?[\s  ]*(?:[-–]\s*)?(.*)$/i;

const MEDIA = /^(?:<media omitted>|<attached: .*>|image omitted|video omitted|audio omitted|sticker omitted|gif omitted|document omitted|contact card omitted|.*\(file attached\))$/i;
const DELETED = /^(?:this message was deleted|you deleted this message|‎?you deleted this message)$/i;

type RawLine = { a: number; b: number; year: number; hour: number; minute: number; second: number; ampm: string | undefined; rest: string };

function readLine(line: string): RawLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
  return { a: Number(m[1]), b: Number(m[2]), year, hour: Number(m[4]), minute: Number(m[5]), second: m[6] ? Number(m[6]) : 0, ampm: m[7]?.toLowerCase(), rest: m[8] };
}

function detectOrder(lines: RawLine[]): ParsedExport['dateOrder'] {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const l of lines) {
    if (l.a > 12) dayFirst++;
    if (l.b > 12) monthFirst++;
  }
  return monthFirst > dayFirst ? 'month-first' : 'day-first';
}

function toDate(l: RawLine, order: ParsedExport['dateOrder']): Date | null {
  const day = order === 'day-first' ? l.a : l.b;
  const month = order === 'day-first' ? l.b : l.a;
  let hour = l.hour;
  if (l.ampm) {
    if (hour < 1 || hour > 12) return null;
    const pm = l.ampm.startsWith('p');
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || l.minute > 59) return null;
  const date = new Date(l.year, month - 1, day, hour, l.minute, l.second);
  return date.getMonth() === month - 1 ? date : null;
}

function splitSender(rest: string): { sender: string; text: string } | null {
  const i = rest.indexOf(': ');
  if (i <= 0 || i > 60) return null;
  return { sender: rest.slice(0, i).replace(/^[‎‏‪-‮]+/, '').trim(), text: rest.slice(i + 2) };
}

export function parseChatExport(content: string): ParsedExport {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const heads = lines.map(readLine);
  const order = detectOrder(heads.filter((h): h is RawLine => h !== null));

  const messages: ExportedMessage[] = [];
  let current: ExportedMessage | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    if (text && !MEDIA.test(text) && !DELETED.test(text)) messages.push({ ...current, text });
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const head = heads[i];
    if (head) {
      flush();
      const when = toDate(head, order);
      const parts = splitSender(head.rest);
      // A dated line without "Name: " is a system notice; a dated line we cannot read ends the previous message.
      if (when && parts) current = { sender: parts.sender, text: parts.text, sentAt: when };
    } else if (current) {
      current.text += `\n${lines[i]}`;
    }
  }
  flush();

  const participants = [...new Set(messages.map((m) => m.sender))];
  return { messages, participants, dateOrder: order };
}

/** "WhatsApp Chat with Rahul.txt" gives "Rahul"; anything else gives the file name without its extension. */
export function chatNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)$/, '');
  const m = /^WhatsApp Chat (?:with|-) (.+)$/i.exec(base);
  return (m ? m[1] : base).trim();
}

/**
 * The names that are probably the user when several chats are imported together: the user is in every chat,
 * so their name shows up in nearly all of the files while everyone else's shows up in a few.
 * Returns nothing for fewer than two chats, where there is nothing to compare.
 */
export function guessMe(chats: readonly { participants: readonly string[] }[]): string[] {
  if (chats.length < 2) return [];
  const counts = new Map<string, number>();
  for (const chat of chats) for (const name of new Set(chat.participants)) counts.set(name, (counts.get(name) ?? 0) + 1);
  const needed = Math.ceil(chats.length * 0.8);
  return [...counts].filter(([, n]) => n >= needed).map(([name]) => name);
}
