import { addDays, fromDay, isValidDay, toDay, type Day, type TimeOfDay } from './dates.ts';
import { hasAny, normalize, tokenize } from './text.ts';

export type FoundDate = {
  day: Day;
  time: TimeOfDay | null;
  /** The words the date came from, shown on the Inbox card. */
  evidence: string;
  /** True for fuzzy phrases like "next week", so the card can ask the user to check. */
  approximate: boolean;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Sunday = 0 ... Saturday = 6. Short forms are listed separately because they collide with ordinary words. */
const WEEKDAYS_LONG: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  // Hinglish spellings
  ravivar: 0, raviwar: 0, itwar: 0, somvar: 1, somwar: 1, mangalvar: 2, mangalwar: 2, budhvar: 3, budhwar: 3,
  guruvar: 4, guruwar: 4, brihaspativar: 4, veervar: 4, shukravar: 5, shukrawar: 5, shanivar: 6, shaniwar: 6,
  // Devanagari
  'रविवार': 0, 'सोमवार': 1, 'मंगलवार': 2, 'बुधवार': 3, 'गुरुवार': 4, 'बृहस्पतिवार': 4, 'शुक्रवार': 5, 'शनिवार': 6,
};
const WEEKDAYS_SHORT: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};
const PREPOSITIONS = ['by', 'on', 'before', 'till', 'until', 'this', 'next', 'every'];

const TODAY_WORDS = ['today', 'tonight', 'tonite', 'aaj', 'aj', 'आज'];
const TOMORROW_WORDS = ['tomorrow', 'tmrw', 'tmr', 'tomorow', '2morrow', 'tommorow', 'tomoro', 'kal', 'कल'];
const DAY_AFTER_WORDS = ['parso', 'parson', 'parsoo', 'परसों', 'परसो'];
/** "kal" is Hindi for both yesterday and tomorrow; these words next to it make it yesterday. */
const PAST_MARKERS = ['tha', 'thi', 'the', 'gaya', 'gayi', 'hua', 'hui', 'था', 'थी', 'थे', 'गया', 'गयी', 'हुआ'];

type Candidate = { day: Day; evidence: string; approximate: boolean; rank: number };

const pad = (n: number) => String(n).padStart(2, '0');

function build(year: number, month: number, day: number): Day | null {
  const d = `${year}-${pad(month)}-${pad(day)}`;
  return isValidDay(d) ? d : null;
}

/** A date written without a year is the next one that is not long past. */
function nearestYear(sent: Day, month: number, day: number): Day | null {
  const sentYear = Number(sent.slice(0, 4));
  const thisYear = build(sentYear, month, day);
  if (!thisYear) return null;
  const monthAgo = addDays(sent, -30);
  return thisYear >= monthAgo ? thisYear : build(sentYear + 1, month, day);
}

function weekdayOnOrAfter(sent: Day, weekday: number): Day {
  const current = fromDay(sent).getDay();
  return addDays(sent, (weekday - current + 7) % 7);
}

/** Look for a time like "5pm", "17:30" or "11:59 pm". */
export function findTime(text: string): TimeOfDay | null {
  const t = normalize(text);
  const ampm = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s?(am|pm|a\.m\.|p\.m\.)/);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2] ?? 0);
    const pm = ampm[3].startsWith('p');
    if (h >= 1 && h <= 12 && m < 60) {
      if (pm && h < 12) h += 12;
      if (!pm && h === 12) h = 0;
      return `${pad(h)}:${pad(m)}`;
    }
  }
  const clock = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (clock) return `${pad(Number(clock[1]))}:${clock[2]}`;
  if (/\bnoon\b/.test(t)) return '12:00';
  if (/\bmidnight\b/.test(t)) return '23:59';
  return null;
}

/**
 * Find the day a message is talking about, relative to when it was sent.
 * Explicit dates win over words like "tomorrow", which win over fuzzy phrases.
 */
export function findDate(text: string, sentAt: Date): FoundDate | null {
  const sent = toDay(sentAt);
  const norm = normalize(text);
  const tokens = tokenize(text);
  const found: Candidate[] = [];

  // 1. Numeric dates, day first as is usual in India: 12/11, 12-11-26, 12.11.2026.
  // "12.11" with no year is skipped because it is as likely to be a time or a decimal.
  for (const m of norm.matchAll(/\b(\d{1,2})([/.-])(\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    let day = Number(m[1]);
    let month = Number(m[3]);
    if (m[4] === undefined && m[2] === ".") continue;
    if (month > 12 && day <= 12) [day, month] = [month, day]; // written month-first
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const year = m[4] === undefined ? null : Number(m[4].length === 2 ? `20${m[4]}` : m[4]);
    const resolved = year === null ? nearestYear(sent, month, day) : build(year, month, day);
    if (resolved) found.push({ day: resolved, evidence: m[0], approximate: false, rank: 0 });
  }

  // 2. "12 nov", "12th november", "nov 12", "november 12th"
  const monthNames = Object.keys(MONTHS).sort((x, y) => y.length - x.length).join('|');
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthNames})\\b(?:\\s*,?\\s*(\\d{4}))?`, 'g');
  const monthFirst = new RegExp(`\\b(${monthNames})\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`, 'g');
  for (const m of norm.matchAll(dayFirst)) {
    const month = MONTHS[m[2]];
    const day = m[3] ? build(Number(m[3]), month, Number(m[1])) : nearestYear(sent, month, Number(m[1]));
    if (day) found.push({ day, evidence: m[0], approximate: false, rank: 0 });
  }
  for (const m of norm.matchAll(monthFirst)) {
    const month = MONTHS[m[1]];
    const day = m[3] ? build(Number(m[3]), month, Number(m[2])) : nearestYear(sent, month, Number(m[2]));
    if (day) found.push({ day, evidence: m[0], approximate: false, rank: 0 });
  }

  // 3. Relative words
  const dayAfterEnglish = /\bday after (?:tomorrow|tmrw)\b/.test(norm);
  if (dayAfterEnglish) found.push({ day: addDays(sent, 2), evidence: 'day after tomorrow', approximate: false, rank: 1 });
  else if (hasAny(tokens, DAY_AFTER_WORDS)) found.push({ day: addDays(sent, 2), evidence: 'parso', approximate: false, rank: 1 });
  else if (hasAny(tokens, TOMORROW_WORDS)) {
    const isKal = tokens.includes('kal') || tokens.includes('कल');
    const onlyKal = isKal && !hasAny(tokens, ['tomorrow', 'tmrw', 'tmr']);
    if (!(onlyKal && hasAny(tokens, PAST_MARKERS))) found.push({ day: addDays(sent, 1), evidence: isKal ? 'kal' : 'tomorrow', approximate: false, rank: 1 });
  } else if (hasAny(tokens, TODAY_WORDS)) found.push({ day: sent, evidence: 'today', approximate: false, rank: 1 });

  const inDays = norm.match(/\bin (\d{1,2}) days?\b/) ?? norm.match(/\b(\d{1,2}) (?:din|दिन) (?:mein|me|baad|में|बाद)\b/);
  if (inDays) found.push({ day: addDays(sent, Number(inDays[1])), evidence: inDays[0], approximate: false, rank: 1 });

  // 4. Weekdays; short forms only after a preposition so "sat" and "sun" in other uses are not read as days
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    const prev = tokens[i - 1];
    let weekday: number | undefined = WEEKDAYS_LONG[w];
    if (weekday === undefined && WEEKDAYS_SHORT[w] !== undefined && prev !== undefined && PREPOSITIONS.includes(prev)) weekday = WEEKDAYS_SHORT[w];
    if (weekday === undefined) continue;
    let day = weekdayOnOrAfter(sent, weekday);
    if (prev === 'next' && day < addDays(sent, 7)) day = addDays(day, 7);
    found.push({ day, evidence: prev === 'next' ? `next ${w}` : w, approximate: false, rank: 2 });
  }

  // 5. Fuzzy phrases
  if (/\bnext week\b/.test(norm) || hasAny(tokens, ['agle hafte', 'agle week', 'अगले हफ्ते', 'अगले सप्ताह'])) {
    found.push({ day: addDays(sent, 7), evidence: 'next week', approximate: true, rank: 3 });
  }

  if (found.length === 0) return null;
  found.sort((a, b) => a.rank - b.rank);
  const best = found[0];
  return { day: best.day, time: findTime(text), evidence: best.evidence, approximate: best.approximate };
}
