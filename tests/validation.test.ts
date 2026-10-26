import { describe, expect, it } from "vitest";
import { validateApiKeyInput, validateBaseUrl, validateModelId, validateText, ValidationError } from "@/lib/text/validation";

describe("input validation", () => {
  it("rejects empty and over-long text", () => {
    expect(() => validateText("   ")).toThrowError(ValidationError);
    expect(() => validateText("a".repeat(11), 10)).toThrow(/too_long/);
    expect(validateText("  hi  ")).toBe("hi");
    // Limits count characters (code points), not UTF-16 units
    expect(validateText("😀".repeat(5), 5)).toBe("😀".repeat(5));
  });
  it("validates base URLs like the Rust layer", () => {
    expect(validateBaseUrl("http://localhost:11434/v1/")).toBe("http://localhost:11434/v1");
    expect(validateBaseUrl("https://openrouter.ai/api/v1")).toBe("https://openrouter.ai/api/v1");
    expect(() => validateBaseUrl("http://10.0.0.5/v1")).toThrow(/insecure_url/);
    expect(() => validateBaseUrl("https://u:p@host/v1")).toThrow(/invalid_url/);
    expect(() => validateBaseUrl("file:///etc/passwd")).toThrow(/invalid_url/);
    expect(() => validateBaseUrl("nope")).toThrow(/invalid_url/);
  });
  it("validates model ids and keys", () => {
    expect(validateModelId(" gpt-4.1-mini ")).toBe("gpt-4.1-mini");
    expect(validateModelId("meta-llama/llama-3.1-8b:free")).toBe("meta-llama/llama-3.1-8b:free");
    expect(() => validateModelId("bad model")).toThrow();
    expect(() => validateApiKeyInput("sk 123")).toThrow();
    expect(validateApiKeyInput(" sk-123 ")).toBe("sk-123");
  });
});
