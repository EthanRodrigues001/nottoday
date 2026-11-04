import { findDate, findTime, type FoundDate } from './message-date.ts';
import { hasAny, hasPhrase, normalize, tokenize } from './text.ts';

/**
 * Rules that decide whether a message asks the user to do something by a date.
 * Each cue adds to a score; a message is suggested when the score is high enough and it
 * has both something to do and something about when. Lists cover English, Hinglish and Hindi,
 * and are meant to grow from real messages (see docs/decisions.md).
 */

const THINGS = [
  'assignment', 'assignments', 'assgn', 'asgn', 'homework', 'hw', 'project', 'report', 'lab', 'journal', 'record',
  'practical', 'worksheet', 'presentation', 'ppt', 'paper', 'essay', 'quiz', 'test', 'exam', 'exams', 'viva', 'seminar',
  'form', 'registration', 'application', 'fees', 'fee', 'document', 'documents', 'survey', 'proposal', 'abstract',
  'thesis', 'synopsis', 'tutorial', 'internals', 'submission',
  'असाइनमेंट', 'गृहकार्य', 'होमवर्क', 'प्रोजेक्ट', 'परीक्षा', 'रिपोर्ट', 'फॉर्म', 'फीस', 'टेस्ट', 'प्रैक्टिकल',
] as const;

const ACTIONS = [
  'submit', 'upload', 'send', 'mail', 'email', 'bring', 'carry', 'complete', 'finish', 'fill', 'register', 'pay',
  'attend', 'prepare', 'hand in', 'turn in', 'share', 'reply', 'confirm',
  'jama', 'jamaa', 'bhejo', 'bhej', 'bhejna', 'lao', 'laana', 'lana', 'dena', 'bharo', 'bharna', 'karo', 'karna',
  'जमा', 'सबमिट', 'भेजें', 'भेजो', 'लाएं', 'लाना', 'भरें', 'भरना', 'करें', 'करो', 'करना',
] as const;

const DEADLINE_CUES = [
  'due', 'deadline', 'last date', 'last day', 'by', 'before', 'till', 'until', 'no later than', 'cutoff', 'cut off',
  'tak', 'pehle', 'se pehle',
  'तक', 'पहले', 'अंतिम तिथि', 'आखिरी तारीख', 'आखरी तारीख',
] as const;

/** "I already submitted", "done", thanks and the like: the thing is finished, not asked for. */
const FINISHED = ['submitted', 'completed', 'done', 'already', 'finished', 'kar diya', 'ho gaya', 'ho gya', 'कर दिया', 'हो गया'] as const;
const PERSONAL_FUTURE = ['i will', 'i ll', 'will send', 'will submit', 'will do', 'main bhejunga', 'main bhejungi'] as const;
const BIRTHDAY = ['birthday', 'bday', "b'day", 'hbd', 'janamdin', 'janmdin', 'जन्मदिन'] as const;

export type Verdict = {
  isDeadline: boolean;
  /** 0 to 1 */
  score: number;
  date: FoundDate | null;
  /** What fired, for the Inbox card and for debugging; never shown as the message itself. */
  reasons: string[];
};

export const DEADLINE_THRESHOLD = 0.55;

export function classifyDeadline(text: string, sentAt: Date): Verdict {
  const tokens = tokenize(text);
  const reasons: string[] = [];
  let score = 0;

  const thing = hasAny(tokens, THINGS);
  const action = hasAny(tokens, ACTIONS);
  const cue = hasAny(tokens, DEADLINE_CUES);
  const date = findDate(text, sentAt);
  const time = findTime(text);

  if (thing) {
    score += 0.3;
    reasons.push('mentions work');
  }
  if (action) {
    score += 0.25;
    reasons.push('asks to do something');
  }
  if (cue) {
    score += 0.25;
    reasons.push('deadline wording');
  }
  if (date) {
    score += 0.25;
    reasons.push(`date: ${date.evidence}`);
  }
  if (time) score += 0.05;
  if (thing && (cue || date)) score += 0.1;

  if (hasAny(tokens, FINISHED)) {
    score -= 0.35;
    reasons.push('sounds finished');
  }
  if (hasAny(tokens, PERSONAL_FUTURE)) {
    score -= 0.2;
    reasons.push('someone else will do it');
  }
  if (hasAny(tokens, BIRTHDAY)) {
    score -= 0.6;
    reasons.push('birthday wish');
  }
  if (normalize(text).trimEnd().endsWith('?')) score -= 0.1;

  score = Math.max(0, Math.min(1, score));
  const isDeadline = score >= DEADLINE_THRESHOLD && (thing || action) && (cue || date !== null);
  return { isDeadline, score, date, reasons };
}

// ---------------------------------------------------------------------------------------------
// Birthdays
// ---------------------------------------------------------------------------------------------

const WISH_PHRASES = [
  'happy birthday', 'happy bday', "happy b'day", 'hbd', 'many happy returns', 'happy returns of the day',
  'janamdin mubarak', 'janmdin mubarak', 'janamdin ki shubhkamnayein', 'janmdin ki hardik shubhkamnayein', 'bday wishes',
  'जन्मदिन मुबारक', 'जन्मदिन की शुभकामनाएं', 'जन्मदिन की हार्दिक शुभकामनाएं', 'हैप्पी बर्थडे', 'हैप्पी बर्थ डे',
] as const;

/** Words that can follow a wish but are not names. */
const NOT_NAMES = new Set([
  'to', 'the', 'my', 'our', 'dear', 'bro', 'sis', 'bhai', 'didi', 'all', 'you', 'u', 'wish', 'wishing', 'again', 'once',
  'in', 'advance', 'ho', 'hai', 'ji', 'sir', 'maam', 'mam', 'madam', 'and', 'from', 'on', 'this', 'day', 'many', 'more',
  'happy', 'birthday', 'bday', 'belated', 'early', 'a', 'very', 'so', 'wishes', 'tc', 'guys', 'everyone', 'team',
  'mubarak', 'dost', 'yaar', 'friend',
]);

export type BirthdayWish = {
  /** Person being wished, or null when the message does not say. */
  name: string | null;
  belated: boolean;
};

/** Pull the person out of a wish. `participants` are names seen in the same chat and win over guesses. */
export function findBirthdayWish(text: string, participants: readonly string[] = []): BirthdayWish | null {
  const tokens = tokenize(text);
  const wishing = hasAny(tokens, WISH_PHRASES) || (hasAny(tokens, ['birthday', 'bday']) && hasAny(tokens, ['wish', 'wishing', 'wishes', 'wished']));
  if (!wishing) return null;

  const belated = hasPhrase(tokens, 'belated');
  const known = participants.map((full) => ({ full, words: tokenize(full).filter((w) => w.length > 2 && !NOT_NAMES.has(w)) }));

  // A known participant named anywhere in the message is the best evidence.
  for (const p of known) {
    if (p.words.some((w) => tokens.includes(w))) return { name: p.full, belated };
  }

  // @mention, as WhatsApp shows them in notifications.
  const mention = text.match(/@([\p{L}][\p{L}\p{M}'.-]{1,30})/u);
  if (mention) return { name: capitalise(mention[1]), belated };

  // The word(s) right after the wish: "happy birthday Rahul", "happy birthday to Rahul Sharma".
  const after = text.match(/(?:happy\s*(?:birthday|b'?day)|hbd|many happy returns(?: of the day)?|janam?din mubarak|जन्मदिन\s*(?:की\s*)?(?:हार्दिक\s*)?(?:मुबारक|शुभकामनाएं)|हैप्पी\s*बर्थ\s*डे)\s*(?:to\s+)?([\p{L}][\p{L}\p{M}'.-]*(?:\s+[\p{L}][\p{L}\p{M}'.-]*)?)/iu);
  if (after) {
    const words = after[1].split(/\s+/).filter((w) => !NOT_NAMES.has(w.toLowerCase().replace(/[.']/g, '')));
    const candidate = [];
    for (const w of words) {
      if (NOT_NAMES.has(w.toLowerCase())) break;
      candidate.push(w);
    }
    if (candidate.length > 0) return { name: candidate.slice(0, 2).map(capitalise).join(' '), belated };
  }

  // "Rahul, happy birthday!" or "Rahul happy birthday"
  const before = text.match(/^([\p{L}][\p{L}\p{M}'.-]*)[,!\s]+(?:happy|hbd|many)/iu);
  if (before && !NOT_NAMES.has(before[1].toLowerCase())) return { name: capitalise(before[1]), belated };

  return { name: null, belated };
}

function capitalise(word: string): string {
  const w = word.replace(/[.,!?'-]+$/g, '');
  return w.charAt(0).toUpperCase() + w.slice(1);
}
