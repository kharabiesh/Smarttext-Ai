/**
 * Writing-tool catalogue. Each tool declares its options (rendered generically by the UI)
 * and a prompt builder. Option labels are localized via `tools.options.<option>.<value>`.
 */

export type ToolId =
  | "paraphrase"
  | "summarize"
  | "grammar"
  | "spelling"
  | "translate"
  | "tone"
  | "email"
  | "expand"
  | "shorten"
  | "headlines"
  | "ideas"
  | "bullets";

export interface SelectOption {
  id: string;
  kind: "select";
  values: string[];
  default: string;
}
export interface TextOption {
  id: string;
  kind: "text";
  default: string;
  maxLength: number;
}
export type ToolOption = SelectOption | TextOption;
export type ToolValues = Record<string, string>;

export interface ToolDefinition {
  id: ToolId;
  icon: string;
  options: ToolOption[];
  placeholderKey: "default" | "email" | "ideas" | "headlines";
  build(input: string, v: ToolValues): { system: string; user: string };
}

const outputLang: SelectOption = { id: "outputLanguage", kind: "select", values: ["auto", "en", "ar"], default: "auto" };

const LANG_NAME: Record<string, string> = {
  en: "English",
  ar: "Modern Standard Arabic",
  fr: "French",
  es: "Spanish",
  de: "German",
  tr: "Turkish",
  zh: "Simplified Chinese",
  ur: "Urdu",
};

function langRule(v: ToolValues): string {
  const l = v.outputLanguage ?? "auto";
  return l === "auto" ? "Respond in the same language as the input." : `Respond in ${LANG_NAME[l]}.`;
}

const ONLY_RESULT = "Return only the result, with no introduction or closing remarks.";
const FAITHFUL = "Preserve the meaning, facts, numbers and names of the original.";

export const TOOLS: ToolDefinition[] = [
  {
    id: "paraphrase",
    icon: "Repeat2",
    placeholderKey: "default",
    options: [{ id: "style", kind: "select", values: ["standard", "fluent", "formal", "simple", "creative"], default: "standard" }, outputLang],
    build: (input, v) => ({
      system: `Paraphrase the user's text in a ${v.style} style, using different wording and sentence structure. ${FAITHFUL} ${langRule(v)} ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "summarize",
    icon: "ListCollapse",
    placeholderKey: "default",
    options: [
      { id: "length", kind: "select", values: ["short", "medium", "long"], default: "medium" },
      { id: "format", kind: "select", values: ["paragraph", "bullets"], default: "paragraph" },
      outputLang,
    ],
    build: (input, v) => {
      const len = { short: "2–3 sentences", medium: "one concise paragraph (about 5–7 sentences)", long: "a detailed summary covering every main point" }[v.length] ?? "one paragraph";
      const fmt = v.format === "bullets" ? "Format it as a Markdown bulleted list." : "Format it as prose.";
      return { system: `Summarize the user's text in ${len}. ${fmt} Include only information present in the text. ${langRule(v)} ${ONLY_RESULT}`, user: input };
    },
  },
  {
    id: "grammar",
    icon: "SpellCheck2",
    placeholderKey: "default",
    options: [{ id: "explain", kind: "select", values: ["no", "yes"], default: "no" }],
    build: (input, v) => ({
      system:
        "Correct grammar, punctuation and agreement errors in the user's text. Do not change the style, vocabulary or meaning beyond what the corrections require. Keep the original language. " +
        (v.explain === "yes"
          ? "After the corrected text, add a line '---' and then a short bulleted list of the corrections made."
          : ONLY_RESULT),
      user: input,
    }),
  },
  {
    id: "spelling",
    icon: "Type",
    placeholderKey: "default",
    options: [],
    build: (input) => ({
      system: `Correct spelling mistakes (including Arabic hamza and taa marbuta errors) in the user's text. Change nothing else: keep wording, grammar and punctuation as they are. Keep the original language. ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "translate",
    icon: "Languages",
    placeholderKey: "default",
    options: [{ id: "target", kind: "select", values: ["en", "ar", "fr", "es", "de", "tr", "zh", "ur"], default: "ar" }],
    build: (input, v) => ({
      system: `Translate the user's text into ${LANG_NAME[v.target] ?? "English"}. Produce a natural, accurate translation that keeps the meaning, tone, formatting, numbers and proper names. ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "tone",
    icon: "SlidersHorizontal",
    placeholderKey: "default",
    options: [{ id: "tone", kind: "select", values: ["friendly", "formal", "confident", "empathetic", "persuasive", "neutral"], default: "friendly" }, outputLang],
    build: (input, v) => ({
      system: `Rewrite the user's text in a ${v.tone} tone. ${FAITHFUL} ${langRule(v)} ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "email",
    icon: "Mail",
    placeholderKey: "email",
    options: [
      { id: "purpose", kind: "select", values: ["request", "followup", "update", "apology", "thanks", "introduction"], default: "request" },
      { id: "tone", kind: "select", values: ["formal", "friendly", "confident", "empathetic", "neutral"], default: "formal" },
      { id: "recipient", kind: "text", default: "", maxLength: 120 },
      outputLang,
    ],
    build: (input, v) => ({
      system:
        `Write a professional ${v.purpose} email based on the user's notes, in a ${v.tone} tone. ` +
        (v.recipient?.trim() ? `Address it to: ${v.recipient.trim()}. ` : "Use a suitable generic greeting. ") +
        `Include a clear subject line first ("Subject: …"), then the body with greeting and sign-off. Use only facts from the notes and placeholders like [Your name] for missing details. ${langRule(v)}`,
      user: input,
    }),
  },
  {
    id: "expand",
    icon: "Expand",
    placeholderKey: "default",
    options: [{ id: "amount", kind: "select", values: ["moderate", "substantial"], default: "moderate" }, outputLang],
    build: (input, v) => ({
      system: `Expand the user's text to about ${v.amount === "substantial" ? "twice" : "one and a half times"} its length by developing its ideas with explanation and transitions. Do not invent statistics, quotations or specific facts. ${langRule(v)} ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "shorten",
    icon: "Shrink",
    placeholderKey: "default",
    options: [{ id: "keep", kind: "select", values: ["75", "50", "25"], default: "50" }, outputLang],
    build: (input, v) => ({
      system: `Shorten the user's text to about ${v.keep}% of its length. Keep the essential points and remove redundancy. ${FAITHFUL} ${langRule(v)} ${ONLY_RESULT}`,
      user: input,
    }),
  },
  {
    id: "headlines",
    icon: "Heading",
    placeholderKey: "headlines",
    options: [
      { id: "count", kind: "select", values: ["3", "5", "10"], default: "5" },
      { id: "headlineStyle", kind: "select", values: ["news", "catchy", "seo", "academic"], default: "catchy" },
      outputLang,
    ],
    build: (input, v) => ({
      system: `Write ${v.count} ${v.headlineStyle} headline options for the user's content. Make them accurate to the content. Return a numbered Markdown list only. ${langRule(v)}`,
      user: input,
    }),
  },
  {
    id: "ideas",
    icon: "Lightbulb",
    placeholderKey: "ideas",
    options: [
      { id: "count", kind: "select", values: ["5", "10"], default: "5" },
      { id: "ideaKind", kind: "select", values: ["content", "business", "solutions", "creative"], default: "content" },
      outputLang,
    ],
    build: (input, v) => {
      const kind = { content: "content topic ideas", business: "business ideas", solutions: "possible solutions", creative: "creative angles" }[v.ideaKind] ?? "ideas";
      return {
        system: `Generate ${v.count} distinct ${kind} for the user's topic. For each, give a short bold title and one sentence of explanation, as a numbered Markdown list. ${langRule(v)}`,
        user: input,
      };
    },
  },
  {
    id: "bullets",
    icon: "List",
    placeholderKey: "default",
    options: [{ id: "maxPoints", kind: "select", values: ["5", "10", "all"], default: "5" }, outputLang],
    build: (input, v) => ({
      system: `Extract the main points of the user's text as a Markdown bulleted list${v.maxPoints === "all" ? "" : ` of at most ${v.maxPoints} points`}. One idea per bullet, concise, using only information from the text. ${langRule(v)} ${ONLY_RESULT}`,
      user: input,
    }),
  },
];

export const TOOL_IDS = TOOLS.map((t) => t.id);
export function getTool(id: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}
export function defaultValues(tool: ToolDefinition): ToolValues {
  return Object.fromEntries(tool.options.map((o) => [o.id, o.default]));
}
