import { describe, expect, it } from "vitest";
import { countCharacters, countWords, readingMinutes } from "@/lib/text/counts";
import { detectDirection, hasArabic } from "@/lib/text/direction";
import { diffTexts } from "@/lib/text/diff";
import { compareTexts, normalize, similarityLevel } from "@/lib/text/similarity";

describe("counts", () => {
  it("counts English and Arabic words", () => {
    expect(countWords("Hello, world! It's 2025.")).toBe(4);
    expect(countWords("مرحبًا بالعالم، هذا اختبار.")).toBe(4);
    expect(countWords("SmartText يدعم English والعربية")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });
  it("counts characters by code point", () => {
    expect(countCharacters("ab c")).toBe(4);
    expect(countCharacters("ab c", false)).toBe(3);
    expect(countCharacters("😀")).toBe(1);
    expect(readingMinutes("")).toBe(0);
    expect(readingMinutes("word ".repeat(450))).toBe(2);
  });
});

describe("direction detection (mixed Arabic/English)", () => {
  it("uses the first strong character", () => {
    expect(detectDirection("مرحبا Hello")).toBe("rtl");
    expect(detectDirection("Hello مرحبا")).toBe("ltr");
    expect(detectDirection("123 — مرحبا")).toBe("rtl");
    expect(detectDirection("  123 ")).toBe("auto");
    expect(hasArabic("abc")).toBe(false);
  });
});

describe("diff (comparison view)", () => {
  it("marks added and removed words", () => {
    const d = diffTexts("The quick brown fox", "The fast brown fox jumps");
    expect(d.parts.filter((p) => p.type === "removed").map((p) => p.value.trim())).toContain("quick");
    expect(d.addedWords).toBe(2);
    expect(d.removedWords).toBe(1);
    expect(d.changedPercent).toBe(25);
  });
  it("handles identical and empty texts", () => {
    expect(diffTexts("same text", "same text").changedPercent).toBe(0);
    expect(diffTexts("", "new").changedPercent).toBe(100);
  });
});

describe("local similarity", () => {
  const a = "Climate change affects agriculture through rising temperatures, changing rainfall patterns and more frequent droughts in many regions.";
  it("identical documents score 100%", () => {
    const r = compareTexts(a, a);
    expect(r.phraseOverlap).toBe(100);
    expect(r.sharedPassages[0].words).toBe(r.wordsA);
    expect(similarityLevel(r)).toBe("high");
  });
  it("finds shared passages inside different documents", () => {
    const b = "In our report we note that rising temperatures, changing rainfall patterns and more frequent droughts in many regions threaten food security.";
    const r = compareTexts(a, b);
    expect(r.sharedPassages[0].text).toBe("rising temperatures changing rainfall patterns and more frequent droughts in many regions");
    expect(r.containmentAinB).toBeGreaterThan(30);
  });
  it("unrelated documents score low", () => {
    const r = compareTexts(a, "The museum opens at nine and offers guided tours for families on weekends.");
    expect(r.phraseOverlap).toBe(0);
    expect(similarityLevel(r)).toBe("low");
  });
  it("normalizes Arabic letter variants and diacritics", () => {
    expect(normalize("أحمد إلى مدرسةٌ")).toBe(normalize("احمد الي مدرسه"));
    const r = compareTexts("ذهب أحمد إلى المدرسة صباحًا مع أخيه الصغير", "ذهب احمد الى المدرسة صباحا مع اخيه الصغير");
    expect(r.phraseOverlap).toBe(100);
  });
});

describe("diff with Arabic text", () => {
  it("diffs whole Arabic words, not letters", () => {
    const d = diffTexts("من المهم جداً أن تتواصل الشركات", "من الضروري أن تتواصل الشركات");
    const removed = d.parts.filter((p) => p.type === "removed").map((p) => p.value.trim());
    const added = d.parts.filter((p) => p.type === "added").map((p) => p.value.trim());
    expect(removed.join(" ")).toContain("المهم");
    expect(added.join(" ")).toContain("الضروري");
    expect(d.parts.filter((p) => p.type === "same").map((p) => p.value).join("")).toContain("أن تتواصل الشركات");
  });
});

describe("textDir", () => {
  it("lets empty or neutral fields inherit the interface direction", async () => {
    const { textDir } = await import("@/lib/text/direction");
    expect(textDir("")).toBeUndefined();
    expect(textDir(" 42 ")).toBeUndefined();
    expect(textDir("نص")).toBe("rtl");
    expect(textDir("text")).toBe("ltr");
  });
});
