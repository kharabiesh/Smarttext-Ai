import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/db/memoryStore";
import { SCHEMA } from "@/lib/db/sqliteStore";
import { HISTORY_LIMIT } from "@/lib/db";
import { DEFAULT_SETTINGS, sanitizeSettings, useSettings } from "@/state/settings";

const entry = (i: number) => ({ id: `h${i}`, kind: "tool" as const, tool: "summarize", input: `in ${i}`, output: `out ${i}`, createdAt: i });

describe("settings persistence", () => {
  it("sanitizes stored settings and keeps defaults for bad values", () => {
    const s = sanitizeSettings({ language: "ar", theme: "neon", timeoutSec: 99999, maxRetries: -3, textModels: { anthropic: "claude-sonnet-5-5", bogus: "x" }, unknownKey: 1 });
    expect(s.language).toBe("ar");
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.timeoutSec).toBe(600);
    expect(s.maxRetries).toBe(0);
    expect(s.textModels.anthropic).toBe("claude-sonnet-5-5");
    expect(s.textModels).not.toHaveProperty("bogus");
    expect(s).not.toHaveProperty("unknownKey");
  });
  it("saves settings through the store and restores them", async () => {
    const store = new MemoryStore("test-store");
    await useSettings.getState().init(store);
    useSettings.getState().update({ language: "ar", theme: "dark", historyEnabled: false });
    await new Promise((r) => setTimeout(r, 0));
    const reopened = new MemoryStore("test-store");
    const restored = sanitizeSettings(await reopened.loadSettings());
    expect(restored).toMatchObject({ language: "ar", theme: "dark", historyEnabled: false });
  });
  it("settings never contain API keys", () => {
    expect(JSON.stringify(DEFAULT_SETTINGS)).not.toMatch(/apiKey|sk-/);
  });
});

describe("MemoryStore (local history)", () => {
  it("stores, lists newest first, deletes and clears history", async () => {
    const s = new MemoryStore();
    await s.addHistory(entry(1));
    await s.addHistory(entry(2));
    expect((await s.listHistory()).map((h) => h.id)).toEqual(["h2", "h1"]);
    await s.deleteHistory("h2");
    expect(await s.listHistory()).toHaveLength(1);
    await s.clearHistory();
    expect(await s.listHistory()).toHaveLength(0);
  });
  it("caps history length", async () => {
    const s = new MemoryStore();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) await s.addHistory(entry(i));
    expect(await s.listHistory()).toHaveLength(HISTORY_LIMIT);
  });
  it("saves, updates and deletes conversations", async () => {
    const s = new MemoryStore();
    const c = { id: "c1", title: "A", createdAt: 1, updatedAt: 1, messages: [] };
    await s.saveConversation(c);
    await s.saveConversation({ ...c, title: "B", updatedAt: 2 });
    expect(await s.listConversations()).toEqual([{ ...c, title: "B", updatedAt: 2 }]);
    await s.deleteConversation("c1");
    expect(await s.listConversations()).toEqual([]);
  });
  it("does not mirror images to localStorage", async () => {
    const s = new MemoryStore("img-store");
    await s.addImage({ id: "i", prompt: "p", aspect: "square", quality: "auto", style: "none", model: "m", size: "1024x1024", base64: "AAAA", mimeType: "image/png", createdAt: 1 });
    await s.saveSettings({ a: 1 });
    expect(localStorage.getItem("img-store")).not.toContain("AAAA");
  });
});

describe("SQLite schema", () => {
  it("creates all tables idempotently and uses parameterised statements", () => {
    const sql = SCHEMA.join("\n");
    for (const t of ["settings", "conversations", "history", "images"]) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
  });
});
