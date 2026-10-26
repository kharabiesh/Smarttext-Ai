/** Word and character counts that work for Arabic and English (Unicode-aware). */
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’\-_.@]*/gu);
  return matches ? matches.length : 0;
}

export function countCharacters(text: string, includeSpaces = true): number {
  const chars = Array.from(text);
  return includeSpaces ? chars.length : chars.filter((c) => !/\s/u.test(c)).length;
}

/** Rough reading time at ~200 words per minute (minimum 1 minute for non-empty text). */
export function readingMinutes(text: string): number {
  const w = countWords(text);
  return w === 0 ? 0 : Math.max(1, Math.round(w / 200));
}
