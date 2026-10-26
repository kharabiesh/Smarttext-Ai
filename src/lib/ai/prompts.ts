/** Prompt builders for the Humanizer. Kept free of UI code so they can be unit-tested. */

export const HUMANIZER_STYLES = ["professional", "academic", "conversational", "concise", "creative"] as const;
export type HumanizerStyle = (typeof HUMANIZER_STYLES)[number];
export type Strength = 1 | 2 | 3;

export interface HumanizerOptions {
  style: HumanizerStyle;
  strength: Strength;
  /** "auto" keeps the input language. */
  outputLanguage: "auto" | "en" | "ar";
  fixGrammar: boolean;
  reduceRepetition: boolean;
}

const STYLE_GUIDE: Record<HumanizerStyle, string> = {
  professional: "a clear, confident professional register suitable for business communication",
  academic: "a precise, formal academic register with careful hedging and no slang",
  conversational: "a warm, natural conversational register, as a thoughtful person would speak",
  concise: "a tight, economical register: remove filler and say each point once",
  creative: "a vivid, engaging register with varied rhythm, while staying faithful to the content",
};

const STRENGTH_GUIDE: Record<Strength, string> = {
  1: "Make light edits only: fix errors and awkward phrasing, keep most sentences as they are.",
  2: "Make moderate edits: rephrase sentences for flow and readability, and restructure where it clearly helps.",
  3: "Rewrite thoroughly: restructure sentences and paragraphs freely for natural flow, while keeping every fact.",
};

export function buildHumanizerPrompt(text: string, o: HumanizerOptions): { system: string; user: string } {
  const lang =
    o.outputLanguage === "auto"
      ? "Write in the same language as the input text (Arabic stays Arabic, English stays English; keep mixed-language terms as they are)."
      : o.outputLanguage === "ar"
        ? "Write the result in Modern Standard Arabic."
        : "Write the result in English.";
  const rules = [
    "You are an expert editor. Rewrite the user's text so it reads naturally and fluently.",
    `Target ${STYLE_GUIDE[o.style]}.`,
    STRENGTH_GUIDE[o.strength],
    "Preserve the original meaning exactly. Keep every fact, number, date, name, quotation, citation and technical term.",
    "Do not add new claims, examples or information that is not in the original.",
    o.fixGrammar ? "Correct grammar, spelling and punctuation." : "Do not change correct grammar unnecessarily.",
    o.reduceRepetition ? "Remove unnecessary repetition and redundant phrases." : "",
    "Keep paragraph breaks and list structure unless restructuring is requested by the strength level.",
    lang,
    "Return only the rewritten text, with no preface, notes or quotation marks around it.",
  ].filter(Boolean);
  return { system: rules.join("\n"), user: text };
}

export const CHAT_SYSTEM_PROMPT =
  "You are SmartText AI, a helpful writing and productivity assistant. Answer in the language the user writes in. " +
  "Use Markdown for structure when helpful. Be accurate and say when you are unsure.";
