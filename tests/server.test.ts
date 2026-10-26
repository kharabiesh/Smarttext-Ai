import { describe, expect, it } from "vitest";
import { forward, ProxyError, redact, resolveUrl } from "../server/providerProxy";

describe("browser dev-mode proxy (server/providerProxy.ts)", () => {
  it("only allows fixed hosts for OpenAI/Anthropic", () => {
    expect(resolveUrl("openai", "https://evil.example", "/chat/completions")).toBe("https://api.openai.com/v1/chat/completions");
    expect(resolveUrl("anthropic", undefined, "/messages")).toBe("https://api.anthropic.com/v1/messages");
    expect(() => resolveUrl("openai", undefined, "/../x")).toThrow(ProxyError);
    expect(() => resolveUrl("openai_compatible", "http://10.1.1.1/v1", "/models")).toThrow(/https/);
  });

  it("attaches keys server-side and strips them from responses (MOCK fetch)", async () => {
    let seen: RequestInit | undefined;
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ error: { message: "echo sk-test-1234567890" } }), { status: 401 });
    }) as unknown as typeof fetch;
    const res = await forward({ provider: "openai", path: "/models", method: "GET" }, { OPENAI_API_KEY: "sk-test-1234567890" }, fakeFetch);
    expect((seen?.headers as Record<string, string>).authorization).toBe("Bearer sk-test-1234567890");
    expect(res.status).toBe(401);
    expect(res.body).not.toContain("sk-test-1234567890");
  });

  it("uses Anthropic headers", async () => {
    let headers: Record<string, string> = {};
    const fakeFetch = (async (_u: string, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await forward({ provider: "anthropic", path: "/messages", body: {} }, { ANTHROPIC_API_KEY: "sk-ant-xyz123456" }, fakeFetch);
    expect(headers["x-api-key"]).toBe("sk-ant-xyz123456");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers.authorization).toBeUndefined();
  });

  it("fails fast without a key and maps timeouts", async () => {
    await expect(forward({ provider: "openai", path: "/models" }, {})).rejects.toMatchObject({ code: "missing_key" });
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("t"), { name: "TimeoutError" }))))) as unknown as typeof fetch;
    await expect(forward({ provider: "openai_compatible", baseUrl: "http://localhost:1/v1", path: "/models", timeoutMs: 1000 }, {}, hang)).rejects.toMatchObject({ code: "timeout" });
  });

  it("redacts", () => {
    expect(redact("a sk-123456 b", "sk-123456")).toBe("a [REDACTED] b");
  });
});
