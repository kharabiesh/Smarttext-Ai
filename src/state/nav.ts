import { create } from "zustand";

export type Page = "dashboard" | "humanizer" | "chat" | "tools" | "image" | "analysis" | "history" | "settings" | "about";
export const PAGES: Page[] = ["dashboard", "humanizer", "chat", "tools", "image", "analysis", "history", "settings", "about"];

interface NavState {
  page: Page;
  /** Optional payload handed to the next page (e.g. text to open in the Humanizer, a tool id, a conversation id). */
  payload: { text?: string; tool?: string; conversationId?: string } | null;
  go(page: Page, payload?: NavState["payload"]): void;
  consume(): NavState["payload"];
}

export const useNav = create<NavState>((set, get) => ({
  page: "dashboard",
  payload: null,
  go(page, payload = null) {
    set({ page, payload });
  },
  consume() {
    const p = get().payload;
    if (p) set({ payload: null });
    return p;
  },
}));
