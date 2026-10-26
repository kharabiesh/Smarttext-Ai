import { diffArrays } from "diff";

export interface DiffPart {
  type: "same" | "added" | "removed";
  value: string;
}

export interface DiffSummary {
  parts: DiffPart[];
  addedWords: number;
  removedWords: number;
  /** Share of the original's words that were changed or removed (0–100). */
  changedPercent: number;
}

const words = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

/**
 * Unicode-aware tokenizer: whole words in any script (Arabic letters + diacritics included), runs of
 * whitespace, and single punctuation marks. jsdiff's built-in word diff treats Arabic as punctuation.
 */
export function tokenizeForDiff(text: string): string[] {
  return text.match(/[\p{L}\p{N}\p{M}_'’]+|\s+|[^\s\p{L}\p{N}\p{M}]/gu) ?? [];
}

/** Word-level diff between the original and revised text (whitespace-aware so paragraphs survive). */
export function diffTexts(original: string, revised: string): DiffSummary {
  const parts: DiffPart[] = [];
  for (const c of diffArrays(tokenizeForDiff(original), tokenizeForDiff(revised))) {
    const type: DiffPart["type"] = c.added ? "added" : c.removed ? "removed" : "same";
    const value = c.value.join("");
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.value += value;
    else parts.push({ type, value });
  }
  const addedWords = parts.filter((p) => p.type === "added").reduce((n, p) => n + words(p.value), 0);
  const removedWords = parts.filter((p) => p.type === "removed").reduce((n, p) => n + words(p.value), 0);
  const total = words(original);
  const changedPercent = total === 0 ? (words(revised) > 0 ? 100 : 0) : Math.min(100, Math.round((removedWords / total) * 100));
  return { parts, addedWords, removedWords, changedPercent };
}
