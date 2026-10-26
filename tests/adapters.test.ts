import { describe, expect, it } from "vitest";
import { openAiCompatibleText, openAiImage, openAiText } from "@/lib/ai/providers/openai";
import { anthropicText } from "@/lib/ai/providers/anthropic";
import { AiError } from "@/lib/ai/errors";

const req = { system: "SYS", messages: [{ role: "user" as const, content: "Hello" }], maxTokens: 100 };

describe("OpenAI adapter (mocked payloads)", () => {
  it("builds a Chat Completions request with the system message first", () => {
    const built = openAiText.buildCompletion(req, "gpt-4.1-mini");
    expect(built.path).toBe("/chat/completions");
    expect(built.body).toEqual({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "SYS" },
        { role: "user", content: "Hello" },
      ],
      max_completion_tokens: 100,
    });
  });
  it("uses max_tokens for OpenAI-compatible servers", () => {
    expect(openAiCompatibleText.buildCompletion(req, "llama3.1").body).toMatchObject({ max_tokens: 100 });
  });
  it("parses text, usage and truncation", () => {
    const r = openAiText.parseCompletion({ choices: [{ message: { content: " Hi " }, finish_reason: "length" }], usage: { prompt_tokens: 3, completion_tokens: 1 } }, "m");
    expect(r).toMatchObject({ text: "Hi", truncated: true, usage: { inputTokens: 3, outputTokens: 1 } });
  });
  it("rejects malformed and empty responses", () => {
    expect(() => openAiText.parseCompletion({ foo: 1 }, "m")).toThrowError(AiError);
    expect(() => openAiText.parseCompletion({ choices: [{ message: { content: "  " } }] }, "m")).toThrow(/empty_result/);
    expect(() => openAiText.parseCompletion({ choices: [{ message: { content: null, refusal: "no" } }] }, "m")).toThrow(/content_filtered/);
  });
  it("maps HTTP errors and extracts provider messages", () => {
    const e = openAiText.parseError(401, JSON.stringify({ error: { message: "Incorrect API key provided: sk-proj-abcdefghijklmnopqrstuv" } }));
    expect(e.code).toBe("invalid_key");
    expect(e.detail).not.toContain("sk-proj-abcdefghijklmnopqrstuv");
    expect(openAiText.parseError(429, '{"error":{"message":"You exceeded your current quota"}}').code).toBe("quota_exceeded");
    expect(openAiText.parseError(429, '{"error":{"message":"Rate limit"}}', 3).retryAfter).toBe(3);
    expect(openAiText.parseError(503, "upstream").code).toBe("server_error");
  });
  it("lists models sorted", () => {
    expect(openAiText.parseListModels({ data: [{ id: "b" }, { id: "a" }] })).toEqual(["a", "b"]);
  });
});

describe("Anthropic adapter (mocked payloads)", () => {
  it("builds a Messages API request with top-level system", () => {
    const built = anthropicText.buildCompletion(req, "claude-opus-5-5");
    expect(built.path).toBe("/messages");
    expect(built.body).toEqual({ model: "claude-opus-5-5", max_tokens: 100, system: "SYS", messages: [{ role: "user", content: "Hello" }] });
  });
  it("joins text blocks and ignores non-text blocks", () => {
    const r = anthropicText.parseCompletion(
      { content: [{ type: "thinking", thinking: "" }, { type: "text", text: "Hello " }, { type: "text", text: "there" }], stop_reason: "end_turn", usage: { input_tokens: 4, output_tokens: 2 } },
      "claude",
    );
    expect(r.text).toBe("Hello there");
    expect(r.usage).toEqual({ inputTokens: 4, outputTokens: 2 });
  });
  it("treats refusals and max_tokens correctly", () => {
    expect(() => anthropicText.parseCompletion({ content: [], stop_reason: "refusal" }, "c")).toThrow(/content_filtered/);
    expect(anthropicText.parseCompletion({ content: [{ type: "text", text: "x" }], stop_reason: "max_tokens" }, "c").truncated).toBe(true);
  });
  it("maps overloaded (529) to a retryable server error", () => {
    const e = anthropicText.parseError(529, JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }));
    expect(e.code).toBe("server_error");
    expect(e.retryable).toBe(true);
    expect(e.detail).toBe("Overloaded");
  });
});

describe("OpenAI image adapter (mocked payloads)", () => {
  it("maps aspect ratios and qualities per model family", () => {
    expect(openAiImage.capabilities("gpt-image-1").sizes.landscape).toBe("1536x1024");
    expect(openAiImage.capabilities("dall-e-3").sizes.portrait).toBe("1024x1792");
    expect(openAiImage.capabilities("dall-e-3").negativePrompt).toBe(false);
  });
  it("builds requests; only DALL·E gets response_format", () => {
    const a = openAiImage.buildImage({ prompt: "a cat", aspect: "portrait", quality: "high", style: "watercolor" }, "gpt-image-1");
    expect(a.body).toMatchObject({ model: "gpt-image-1", size: "1024x1536", quality: "high", n: 1 });
    expect((a.body as Record<string, unknown>).response_format).toBeUndefined();
    expect((a.body as { prompt: string }).prompt).toMatch(/watercolour/);
    const b = openAiImage.buildImage({ prompt: "a cat", aspect: "square", quality: "high", style: "none" }, "dall-e-3");
    expect(b.body).toMatchObject({ quality: "standard", response_format: "b64_json", prompt: "a cat" });
  });
  it("parses base64 images and rejects missing data", () => {
    expect(openAiImage.parseImage({ data: [{ b64_json: "AAAA", revised_prompt: "rp" }] }, "1024x1024")).toEqual({ base64: "AAAA", mimeType: "image/png", revisedPrompt: "rp", size: "1024x1024" });
    expect(() => openAiImage.parseImage({ data: [{ url: "https://x" }] }, "s")).toThrow(/empty_result/);
    expect(() => openAiImage.parseImage({}, "s")).toThrow(/invalid_response/);
  });
  it("maps content-policy rejections", () => {
    expect(openAiImage.parseError(400, '{"error":{"message":"Your request was rejected by our safety system"}}').code).toBe("content_filtered");
  });
});
