/**
 * Local text-similarity analysis between documents the user supplies.
 * This is NOT an internet plagiarism check: it only compares the texts given to it.
 */

/** Normalises text for comparison: lower-case, strip Arabic diacritics/tatweel, unify alef/yaa/taa marbuta forms. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/gu, "")
    .replace(/[آأإ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه");
}

export function tokenize(text: string): string[] {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function shingles(tokens: string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(" "));
  return out;
}

function cosine(a: string[], b: string[]): number {
  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  a.forEach((t) => fa.set(t, (fa.get(t) ?? 0) + 1));
  b.forEach((t) => fb.set(t, (fb.get(t) ?? 0) + 1));
  let dot = 0;
  fa.forEach((v, k) => (dot += v * (fb.get(k) ?? 0)));
  const na = Math.sqrt([...fa.values()].reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt([...fb.values()].reduce((s, v) => s + v * v, 0));
  return na === 0 || nb === 0 ? 0 : dot / (na * nb);
}

export interface SharedPassage {
  text: string;
  words: number;
}

export interface SimilarityReport {
  /** Jaccard overlap of 3-word sequences (0–100). */
  phraseOverlap: number;
  /** Share of document A's 3-word sequences that also appear in B (0–100). */
  containmentAinB: number;
  containmentBinA: number;
  /** Cosine similarity of word frequencies (0–100): shared vocabulary regardless of order. */
  vocabularySimilarity: number;
  sharedPassages: SharedPassage[];
  wordsA: number;
  wordsB: number;
}

/** Finds maximal runs of identical consecutive tokens (≥ minWords) shared by both texts. */
export function findSharedPassages(a: string[], b: string[], minWords = 6): SharedPassage[] {
  const index = new Map<string, number[]>();
  const n = 3;
  for (let j = 0; j + n <= b.length; j++) {
    const key = b.slice(j, j + n).join(" ");
    const list = index.get(key);
    if (list) list.push(j);
    else index.set(key, [j]);
  }
  const passages: SharedPassage[] = [];
  let i = 0;
  while (i + n <= a.length) {
    const starts = index.get(a.slice(i, i + n).join(" "));
    let best = 0;
    if (starts) {
      for (const j of starts) {
        let len = 0;
        while (i + len < a.length && j + len < b.length && a[i + len] === b[j + len]) len++;
        best = Math.max(best, len);
      }
    }
    if (best >= minWords) {
      passages.push({ text: a.slice(i, i + best).join(" "), words: best });
      i += best;
    } else {
      i++;
    }
  }
  return passages.sort((x, y) => y.words - x.words);
}

export function compareTexts(textA: string, textB: string): SimilarityReport {
  const a = tokenize(textA);
  const b = tokenize(textB);
  const sa = shingles(a, 3);
  const sb = shingles(b, 3);
  let inter = 0;
  sa.forEach((s) => sb.has(s) && inter++);
  const union = sa.size + sb.size - inter;
  const pct = (x: number) => Math.round(x * 1000) / 10;
  return {
    phraseOverlap: union === 0 ? 0 : pct(inter / union),
    containmentAinB: sa.size === 0 ? 0 : pct(inter / sa.size),
    containmentBinA: sb.size === 0 ? 0 : pct(inter / sb.size),
    vocabularySimilarity: pct(cosine(a, b)),
    sharedPassages: findSharedPassages(a, b),
    wordsA: a.length,
    wordsB: b.length,
  };
}

export type SimilarityLevel = "low" | "moderate" | "high";
export function similarityLevel(r: SimilarityReport): SimilarityLevel {
  const m = Math.max(r.containmentAinB, r.containmentBinA);
  if (m >= 50) return "high";
  if (m >= 15) return "moderate";
  return "low";
}
