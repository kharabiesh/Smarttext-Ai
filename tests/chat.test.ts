import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/db/memoryStore";
import { setStoreForTests } from "@/lib/db";
import { setTransportForTests } from "@/state/ai";
import { titleFrom, useChat } from "@/state/chat";
import { DEFAULT_SETTINGS, useSettings } from "@/state/settings";
import { mockTransport, openAiChat } from "./helpers";

let store: MemoryStore;
beforeEach(async () => {
  store = new MemoryStore();
  setStoreForTests(store);
  await useSettings.getState().init(store);
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS } });
  useChat.setState({ conversations: [], activeId: null, pending: false, error: null, loaded: false });
});

describe("chat conversation history (MOCK provider)", () => {
  it("creates a conversation, replies, and persists it locally", async () => {
    const m = mockTransport([openAiChat("Hello! How can I help?")]);
    setTransportForTests(m.transport);
    await useChat.getState().send("Hi there, please help me write an email to my manager");
    const c = useChat.getState().conversations[0];
    expect(c.title).toBe("Hi there, please help me write an email to my m…");
    expect(c.messages.map((x) => x.role)).toEqual(["user", "assistant"]);
    expect((await store.listConversations())[0].messages).toHaveLength(2);
    const body = m.calls[0].body as { messages: Array<{ role: string }> };
    expect(body.messages[0].role).toBe("system");
  });

  it("sends the whole conversation for context and regenerates the last answer", async () => {
    const m = mockTransport([openAiChat("A1"), openAiChat("A2"), openAiChat("A2-regenerated")]);
    setTransportForTests(m.transport);
    await useChat.getState().send("Q1");
    await useChat.getState().send("Q2");
    expect((m.calls[1].body as { messages: unknown[] }).messages).toHaveLength(4); // system + Q1 + A1 + Q2
    await useChat.getState().regenerate();
    const msgs = useChat.getState().conversations[0].messages;
    expect(msgs.map((x) => x.content)).toEqual(["Q1", "A1", "Q2", "A2-regenerated"]);
  });

  it("keeps the user message and exposes the error when the provider fails", async () => {
    setTransportForTests(mockTransport([{ status: 401, body: '{"error":{"message":"bad"}}' }]).transport);
    await useChat.getState().send("Hello");
    expect(useChat.getState().conversations[0].messages).toHaveLength(1);
    expect(useChat.getState().error).toMatchObject({ code: "invalid_key" });
    expect(useChat.getState().pending).toBe(false);
  });

  it("renames and deletes conversations", async () => {
    setTransportForTests(mockTransport([openAiChat("ok")]).transport);
    await useChat.getState().send("Hello");
    const id = useChat.getState().conversations[0].id;
    await useChat.getState().rename(id, "  Project notes  ");
    expect((await store.listConversations())[0].title).toBe("Project notes");
    await useChat.getState().remove(id);
    expect(useChat.getState().conversations).toHaveLength(0);
    expect(await store.listConversations()).toHaveLength(0);
  });

  it("does not store conversations when chat history is disabled", async () => {
    useSettings.getState().update({ chatHistoryEnabled: false });
    setTransportForTests(mockTransport([openAiChat("ok")]).transport);
    await useChat.getState().send("private question");
    expect(useChat.getState().conversations).toHaveLength(1);
    expect(await store.listConversations()).toHaveLength(0);
  });

  it("validates empty messages", async () => {
    await expect(useChat.getState().send("   ")).rejects.toMatchObject({ code: "empty" });
  });

  it("titles are single-line and truncated", () => {
    expect(titleFrom("a\n\nb")).toBe("a b");
  });
});
