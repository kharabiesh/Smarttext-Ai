import { create } from "zustand";
import { openStore, type ChatMessage, type Conversation } from "@/lib/db";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { validateText, MAX_CHAT_MESSAGE_CHARS } from "@/lib/text/validation";
import { newId } from "@/lib/id";
import { ai } from "./ai";
import { useSettings } from "./settings";

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  pending: boolean;
  error: unknown;
  loaded: boolean;
  load(): Promise<void>;
  select(id: string | null): void;
  newConversation(): void;
  send(text: string): Promise<void>;
  regenerate(): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export function titleFrom(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 47)}…` : oneLine;
}

async function persist(c: Conversation) {
  if (!useSettings.getState().settings.chatHistoryEnabled) return;
  const store = await openStore();
  await store.saveConversation(c);
}

export const useChat = create<ChatState>((set, get) => {
  const replace = (c: Conversation) => set({ conversations: [c, ...get().conversations.filter((x) => x.id !== c.id)] });

  /** Requests an assistant reply for the conversation as it stands (last message must be from the user). */
  const complete = async (conv: Conversation) => {
    set({ pending: true, error: null });
    try {
      const res = await ai.complete({
        system: CHAT_SYSTEM_PROMPT,
        messages: conv.messages.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: 8000,
      });
      const reply: ChatMessage = { id: newId(), role: "assistant", content: res.text, createdAt: Date.now(), model: res.model };
      const updated = { ...conv, messages: [...conv.messages, reply], updatedAt: Date.now() };
      replace(updated);
      await persist(updated);
    } catch (e) {
      set({ error: e });
    } finally {
      set({ pending: false });
    }
  };

  return {
    conversations: [],
    activeId: null,
    pending: false,
    error: null,
    loaded: false,
    async load() {
      if (get().loaded) return;
      const store = await openStore();
      const conversations = useSettings.getState().settings.chatHistoryEnabled ? await store.listConversations() : [];
      set({ conversations, loaded: true, activeId: conversations[0]?.id ?? null });
    },
    select(id) {
      set({ activeId: id, error: null });
    },
    newConversation() {
      set({ activeId: null, error: null });
    },
    async send(text) {
      if (get().pending) return;
      const content = validateText(text, MAX_CHAT_MESSAGE_CHARS);
      const now = Date.now();
      const existing = get().conversations.find((c) => c.id === get().activeId);
      const userMsg: ChatMessage = { id: newId(), role: "user", content, createdAt: now };
      const conv: Conversation = existing
        ? { ...existing, messages: [...existing.messages, userMsg], updatedAt: now }
        : { id: newId(), title: titleFrom(content), createdAt: now, updatedAt: now, messages: [userMsg] };
      replace(conv);
      set({ activeId: conv.id });
      await persist(conv);
      useSettings.getState().markUsed("chat");
      await complete(conv);
    },
    async regenerate() {
      const conv = get().conversations.find((c) => c.id === get().activeId);
      if (!conv || get().pending) return;
      const msgs = [...conv.messages];
      while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
      if (!msgs.length) return;
      const trimmed = { ...conv, messages: msgs, updatedAt: Date.now() };
      replace(trimmed);
      await complete(trimmed);
    },
    async rename(id, title) {
      const conv = get().conversations.find((c) => c.id === id);
      const clean = title.trim().slice(0, 120);
      if (!conv || !clean) return;
      const updated = { ...conv, title: clean };
      set({ conversations: get().conversations.map((c) => (c.id === id ? updated : c)) });
      await persist(updated);
    },
    async remove(id) {
      set({ conversations: get().conversations.filter((c) => c.id !== id), activeId: get().activeId === id ? null : get().activeId });
      const store = await openStore();
      await store.deleteConversation(id);
    },
    async clearAll() {
      set({ conversations: [], activeId: null });
      const store = await openStore();
      await store.clearConversations();
    },
  };
});
