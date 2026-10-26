import { describe, expect, it } from "vitest";
import { AiClient, type ClientConfig } from "@/lib/ai/client";
import { AiError } from "@/lib/ai/errors";
import { mockTransport, ok, openAiChat } from "./helpers";

const base: ClientConfig = { textProvider: "openai", textModel: "gpt-test", imageProvider: "openai", imageModel: "gpt-image-1", timeoutMs: 1000, maxRetries: 2 };
const noSleep = async () => {};
const client = (t: ReturnType<typeof mockTransport>["transport"], cfg: Partial<ClientConfig> = {}) => new AiClient(t, () => ({ ...base, ...cfg }), noSleep);

describe("AiClient with a MOCK transport", () => {
  it("completes text and passes timeout + provider to the transport", async () => {
    const m = mockTransport([openAiChat("Done")]);
    const r = await client(m.transport).complete({ messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("Done");
    expect(m.calls[0]).toMatchObject({ provider: "openai", path: "/chat/completions", method: "POST", timeoutMs: 1000 });
    expect(m.calls[0].baseUrl).toBeUndefined();
  });

  it("retries rate limits and server errors, then succeeds", async () => {
    const m = mockTransport([{ status: 429, body: "{}" }, { status: 502, body: "bad gateway" }, openAiChat("ok")]);
    const r = await client(m.transport).complete({ messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("ok");
    expect(m.calls).toHaveLength(3);
  });

  it("stops after maxRetries", async () => {
    const m = mockTransport([{ status: 429, body: '{"error":{"message":"slow down"}}' }]);
    await expect(client(m.transport, { maxRetries: 1 }).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "rate_limited" });
    expect(m.calls).toHaveLength(2);
  });

  it("does not retry invalid keys", async () => {
    const m = mockTransport([{ status: 401, body: '{"error":{"message":"bad key"}}' }]);
    await expect(client(m.transport).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "invalid_key" });
    expect(m.calls).toHaveLength(1);
  });

  it("maps transport errors (Rust CommandError shape) such as missing keys and timeouts", async () => {
    const missing = mockTransport([Object.assign(new Error("x"), { code: "missing_key" })]);
    await expect(client(missing.transport).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "missing_key" });
    const slow = mockTransport([() => new Promise(() => {}) as never]);
    const t0 = Date.now();
    await expect(client(slow.transport, { timeoutMs: 10, maxRetries: 0 }).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "timeout" });
    expect(Date.now() - t0).toBeLessThan(8000);
  }, 10000);

  it("reports invalid JSON as invalid_response", async () => {
    const m = mockTransport([{ status: 200, body: "<html>" }]);
    await expect(client(m.transport).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("requires a base URL for OpenAI-compatible servers and forwards it", async () => {
    const m = mockTransport([openAiChat("hi")]);
    await expect(client(m.transport, { textProvider: "openai_compatible" }).complete({ messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ code: "not_configured" });
    await client(m.transport, { textProvider: "openai_compatible", compatibleBaseUrl: "http://localhost:11434/v1" }).complete({ messages: [{ role: "user", content: "x" }] });
    expect(m.calls[0].baseUrl).toBe("http://localhost:11434/v1");
  });

  it("generates images and refuses when no image provider is configured", async () => {
    const m = mockTransport([ok({ data: [{ b64_json: "iVBORw0KGgo=" }] })]);
    const img = await client(m.transport).generateImage({ prompt: "p", aspect: "landscape", quality: "auto", style: "none" });
    expect(img.size).toBe("1536x1024");
    expect(m.calls[0].path).toBe("/images/generations");
    await expect(client(m.transport, { imageProvider: "none" }).generateImage({ prompt: "p", aspect: "square", quality: "auto", style: "none" })).rejects.toBeInstanceOf(AiError);
  });

  it("surfaces image-generation failures without fabricating a result", async () => {
    const m = mockTransport([{ status: 400, body: '{"error":{"message":"Your request was rejected by our safety system"}}' }]);
    await expect(client(m.transport).generateImage({ prompt: "p", aspect: "square", quality: "auto", style: "none" })).rejects.toMatchObject({ code: "content_filtered" });
  });

  it("lists models for connection tests", async () => {
    const m = mockTransport([ok({ data: [{ id: "claude-opus-5-5" }] })]);
    expect(await client(m.transport).listModels("anthropic")).toEqual(["claude-opus-5-5"]);
    expect(m.calls[0]).toMatchObject({ provider: "anthropic", path: "/models", method: "GET" });
  });
});
