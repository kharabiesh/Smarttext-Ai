const RTL_CHAR = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;
const LTR_CHAR = /[A-Za-zÀ-ɏ]/u;

/** Detects the dominant direction of a text by its first strong character (Unicode bidi "first strong" rule). */
export function detectDirection(text: string): "rtl" | "ltr" | "auto" {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return "rtl";
    if (LTR_CHAR.test(ch)) return "ltr";
  }
  return "auto";
}

export function hasArabic(text: string): boolean {
  return /[؀-ۿ]/u.test(text);
}

/**
 * `dir` attribute for an editable field: the text's own direction, or undefined while it has
 * no strong characters so the field (and its placeholder) inherits the interface direction.
 */
export function textDir(text: string): "rtl" | "ltr" | undefined {
  const d = detectDirection(text);
  return d === "auto" ? undefined : d;
}
