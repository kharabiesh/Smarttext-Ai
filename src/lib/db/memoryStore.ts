import { HISTORY_LIMIT, IMAGE_LIMIT, type Conversation, type HistoryEntry, type ImageRecord, type Store } from "./types";

interface Data {
  settings: Record<string, unknown> | null;
  conversations: Conversation[];
  history: HistoryEntry[];
  images: ImageRecord[];
}

const empty = (): Data => ({ settings: null, conversations: [], history: [], images: [] });

/**
 * In-memory store, optionally mirrored to localStorage (browser dev mode).
 * Images are never mirrored to localStorage because of its small quota.
 */
export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  private data: Data;

  constructor(private readonly storageKey?: string) {
    this.data = empty();
    if (storageKey && typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) this.data = { ...empty(), ...(JSON.parse(raw) as Partial<Data>), images: [] };
      } catch {
        this.data = empty();
      }
    }
  }

  private persist() {
    if (!this.storageKey || typeof localStorage === "undefined") return;
    try {
      const { images: _images, ...rest } = this.data;
      localStorage.setItem(this.storageKey, JSON.stringify(rest));
    } catch {
      /* quota exceeded – keep in memory only */
    }
  }

  async loadSettings() {
    return this.data.settings ? { ...this.data.settings } : null;
  }
  async saveSettings(settings: Record<string, unknown>) {
    this.data.settings = { ...settings };
    this.persist();
  }
  async listConversations() {
    return [...this.data.conversations].sort((a, b) => b.updatedAt - a.updatedAt).map((c) => structuredClone(c));
  }
  async saveConversation(c: Conversation) {
    const i = this.data.conversations.findIndex((x) => x.id === c.id);
    if (i >= 0) this.data.conversations[i] = structuredClone(c);
    else this.data.conversations.push(structuredClone(c));
    this.persist();
  }
  async deleteConversation(id: string) {
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    this.persist();
  }
  async clearConversations() {
    this.data.conversations = [];
    this.persist();
  }
  async addHistory(e: HistoryEntry) {
    this.data.history = [e, ...this.data.history].slice(0, HISTORY_LIMIT);
    this.persist();
  }
  async listHistory(limit = HISTORY_LIMIT) {
    return [...this.data.history].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  async deleteHistory(id: string) {
    this.data.history = this.data.history.filter((h) => h.id !== id);
    this.persist();
  }
  async clearHistory() {
    this.data.history = [];
    this.persist();
  }
  async addImage(r: ImageRecord) {
    this.data.images = [r, ...this.data.images].slice(0, IMAGE_LIMIT);
  }
  async listImages(limit = IMAGE_LIMIT) {
    return [...this.data.images].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  async deleteImage(id: string) {
    this.data.images = this.data.images.filter((i) => i.id !== id);
  }
  async clearImages() {
    this.data.images = [];
  }
}
