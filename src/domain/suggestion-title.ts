const GREETING = /^(?:(?:hi|hello|hey|dear|good\s+(?:morning|afternoon|evening)|namaste|attention)\b[\s\w,.!-]{0,30}?[,.!:\-]\s*)+/i;

/**
 * A short task title from a message: drops a greeting, keeps the first sentence or line,
 * and cuts to a length that fits a row. The user can edit it on the Inbox card.
 */
export function suggestionTitle(snippet: string, maxLength = 80): string {
  const firstLine = snippet.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? snippet;
  let text = firstLine.replace(/\s+/g, ' ');
  text = text.replace(GREETING, '').trim() || text;
  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const result = sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trimEnd()}…` : sentence;
  const title = result.replace(/[.\s]+$/, '') || snippet.slice(0, maxLength);
  return title.charAt(0).toUpperCase() + title.slice(1);
}
