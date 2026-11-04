/**
 * Text helpers shared by the date finder and the classifier. Messages mix English, Hinglish
 * (Hindi in Roman letters) and Hindi (Devanagari), so everything works on Unicode letters.
 */

/** Lower-case and unify punctuation and spacing. Combining marks stay, because they are part of Devanagari letters. */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words as runs of letters, combining marks and digits. Works for Latin and Devanagari. */
export function tokenize(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/** True when any phrase occurs in the text as whole words (so "tak" does not match inside "stake"). */
export function hasPhrase(tokens: string[], phrase: string): boolean {
  const words = phrase.split(' ');
  for (let i = 0; i + words.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < words.length; j++) {
      if (tokens[i + j] !== words[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function hasAny(tokens: string[], phrases: readonly string[]): boolean {
  return phrases.some((p) => hasPhrase(tokens, p));
}
