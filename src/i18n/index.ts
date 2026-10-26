import en, { type Dictionary } from "./en";
import ar from "./ar";

export type Language = "en" | "ar";
export const DICTIONARIES: Record<Language, Dictionary> = { en, ar };

/** Dot-path lookup with `{name}` interpolation. Falls back to English, then to the key itself. */
export function translate(lang: Language, key: string, vars?: Record<string, string | number>): string {
  const lookup = (dict: unknown): string | undefined => {
    const v = key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), dict);
    return typeof v === "string" ? v : undefined;
  };
  const raw = lookup(DICTIONARIES[lang]) ?? lookup(DICTIONARIES.en) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? formatVar(lang, vars[name]) : m));
}

function formatVar(lang: Language, v: string | number): string {
  // Western digits are used in both languages for consistency with code, model ids and percentages.
  return typeof v === "number" ? new Intl.NumberFormat(lang === "ar" ? "ar-u-nu-latn" : "en").format(v) : v;
}

export const dirFor = (lang: Language): "rtl" | "ltr" => (lang === "ar" ? "rtl" : "ltr");
export type { Dictionary };
