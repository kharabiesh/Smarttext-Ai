import { describe, expect, it } from "vitest";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { dirFor, translate } from "@/i18n";
import { TOOLS } from "@/lib/ai/tools";
import { HUMANIZER_STYLES } from "@/lib/ai/prompts";
import { IMAGE_STYLES } from "@/lib/ai/imageStyles";

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const fe = flatten(en);
const fa = flatten(ar);

describe("localization", () => {
  it("Arabic has exactly the same keys as English", () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(fe).sort());
  });
  it("no empty strings", () => {
    for (const [k, v] of [...Object.entries(fe), ...Object.entries(fa)]) expect(v.trim(), k).not.toBe("");
  });
  it("Arabic strings are actually translated (not English copies)", () => {
    // Allowed to stay Latin: brand/product names, numbers, file names and the developer's name.
    const allowLatin = /^(app\.name|chat\.assistant|.*developerName|humanizer\.exportName|settings\.providerNames\.(openai|anthropic)|tools\.options\.(count|maxPoints)\.\d+|.*\.(\d+))$/;
    const untranslated = Object.entries(fa).filter(([k, v]) => !allowLatin.test(k) && !/[؀-ۿ]/.test(v));
    expect(untranslated).toEqual([]);
  });
  it("placeholders match between languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of Object.keys(fe)) expect(vars(fa[k]), k).toBe(vars(fe[k]));
  });
  it("interpolates and falls back", () => {
    expect(translate("en", "common.words", { count: 1200 })).toBe("1,200 words");
    expect(translate("ar", "common.words", { count: 3 })).toBe("3 كلمة");
    expect(translate("ar", "does.not.exist")).toBe("does.not.exist");
  });
  it("sets direction per language", () => {
    expect(dirFor("ar")).toBe("rtl");
    expect(dirFor("en")).toBe("ltr");
  });
  it("every tool, option value, style and image style has a label in both languages", () => {
    for (const lang of ["en", "ar"] as const) {
      const f = lang === "en" ? fe : fa;
      for (const tool of TOOLS) {
        expect(f[`tools.names.${tool.id}`], tool.id).toBeTruthy();
        expect(f[`tools.descriptions.${tool.id}`]).toBeTruthy();
        for (const o of tool.options) {
          expect(f[`tools.options.${o.id}.label`], `${tool.id}.${o.id}`).toBeTruthy();
          if (o.kind === "select") for (const v of o.values) expect(f[`tools.options.${o.id}.${v}`], `${o.id}.${v}`).toBeTruthy();
        }
      }
      for (const s of HUMANIZER_STYLES) expect(f[`humanizer.styles.${s}`]).toBeTruthy();
      for (const s of IMAGE_STYLES) expect(f[`image.styles.${s}`]).toBeTruthy();
    }
  });
});
