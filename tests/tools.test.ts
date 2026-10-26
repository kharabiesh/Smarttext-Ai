import { describe, expect, it } from "vitest";
import { TOOLS, defaultValues, getTool } from "@/lib/ai/tools";
import { buildHumanizerPrompt } from "@/lib/ai/prompts";

describe("writing tools", () => {
  it("provides the twelve required tools", () => {
    expect(TOOLS.map((t) => t.id)).toEqual(["paraphrase", "summarize", "grammar", "spelling", "translate", "tone", "email", "expand", "shorten", "headlines", "ideas", "bullets"]);
  });
  it("every tool builds a prompt with the user's text untouched", () => {
    for (const tool of TOOLS) {
      const p = tool.build("Original input text", defaultValues(tool));
      expect(p.user).toBe("Original input text");
      expect(p.system.length).toBeGreaterThan(40);
      expect(p.system).not.toMatch(/undefined/);
    }
  });
  it("defaults are valid option values", () => {
    for (const tool of TOOLS) for (const o of tool.options) if (o.kind === "select") expect(o.values).toContain(o.default);
  });
  it("applies options", () => {
    expect(getTool("translate")!.build("x", { target: "fr" }).system).toContain("French");
    expect(getTool("summarize")!.build("x", { length: "short", format: "bullets", outputLanguage: "ar" }).system).toMatch(/2–3 sentences.*bulleted.*Arabic/s);
    expect(getTool("email")!.build("x", { purpose: "followup", tone: "formal", recipient: "Ms. Sara", outputLanguage: "auto" }).system).toMatch(/followup.*Ms\. Sara/s);
    expect(getTool("shorten")!.build("x", { keep: "25" }).system).toContain("25%");
  });
});

describe("humanizer prompt", () => {
  const base = { style: "academic" as const, strength: 3 as const, outputLanguage: "auto" as const, fixGrammar: true, reduceRepetition: false };
  it("prioritises meaning preservation and style/strength settings", () => {
    const p = buildHumanizerPrompt("text", base);
    expect(p.system).toMatch(/Preserve the original meaning/);
    expect(p.system).toMatch(/academic/);
    expect(p.system).toMatch(/Rewrite thoroughly/);
    expect(p.system).toMatch(/same language as the input/);
    expect(p.system).not.toMatch(/Remove unnecessary repetition/);
  });
  it("never instructs evasion of AI detectors", () => {
    const p = buildHumanizerPrompt("text", { ...base, reduceRepetition: true, outputLanguage: "ar" });
    expect(p.system.toLowerCase()).not.toMatch(/detector|undetectable|bypass|gptzero|turnitin/);
    expect(p.system).toMatch(/Modern Standard Arabic/);
  });
});
