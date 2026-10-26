import { describe, expect, it, vi } from "vitest";
import { AiError, errorFromStatus, scrubSecrets, toAiError } from "@/lib/ai/errors";
import { withRetry } from "@/lib/ai/retry";
import { logger } from "@/lib/logger";

describe("credential scrubbing", () => {
  it("removes OpenAI, Anthropic and bearer tokens", () => {
    const s = scrubSecrets("key sk-proj-ABCDEFGHIJKLMNOPQRST and sk-ant-api03-XYZXYZXYZXYZ and Bearer abc.def.ghijkl and api_key=SECRET123456");
    expect(s).not.toMatch(/ABCDEFGHIJKLMNOPQRST|XYZXYZXYZXYZ|abc\.def\.ghijkl|SECRET123456/);
    expect(s).toContain("[REDACTED]");
  });
  it("logger never prints secrets", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("failed with", new Error("Invalid key sk-proj-1234567890abcdefghij"), { auth: "Bearer zzzzzzzzzzzz" });
    const printed = spy.mock.calls.flat().join(" ");
    expect(printed).not.toContain("1234567890abcdefghij");
    expect(printed).not.toContain("zzzzzzzzzzzz");
    spy.mockRestore();
  });
});

describe("error mapping", () => {
  it.each([
    [401, "invalid_key"],
    [403, "invalid_key"],
    [404, "model_not_found"],
    [408, "timeout"],
    [422, "bad_request"],
    [500, "server_error"],
    [418, "unknown"],
  ])("HTTP %i → %s", (status, code) => {
    expect(errorFromStatus(status).code).toBe(code);
  });
  it("converts unknown values safely", () => {
    expect(toAiError({ code: "keychain_unavailable", message: "x" }).code).toBe("keychain_unavailable");
    expect(toAiError({ code: "weird" }).code).toBe("unknown");
    expect(toAiError(new TypeError("Failed to fetch")).code).toBe("network");
    expect(toAiError("boom").code).toBe("unknown");
  });
});

describe("withRetry", () => {
  it("uses retry-after when provided and exponential backoff otherwise", async () => {
    const delays: number[] = [];
    let n = 0;
    await withRetry(
      async () => {
        n++;
        if (n === 1) throw new AiError("rate_limited", { retryAfter: 2 });
        if (n === 2) throw new AiError("server_error");
        return "ok";
      },
      { maxRetries: 3, baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) },
    );
    expect(delays).toEqual([2000, 200]);
  });
});
