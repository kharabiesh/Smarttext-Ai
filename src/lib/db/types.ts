import type { ChatRole } from "../ai/types";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  model?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export type HistoryKind = "humanizer" | "tool";

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** Writing tool id, or "humanizer". */
  tool: string;
  input: string;
  output: string;
  options?: Record<string, unknown>;
  model?: string;
  createdAt: number;
}

export interface ImageRecord {
  id: string;
  prompt: string;
  aspect: string;
  quality: string;
  style: string;
  model: string;
  size: string;
  base64: string;
  mimeType: string;
  revisedPrompt?: string;
  createdAt: number;
}

/** Persistence boundary. Desktop uses SQLite (tauri-plugin-sql); browser dev mode and tests use MemoryStore. */
export interface Store {
  readonly kind: "sqlite" | "memory";
  loadSettings(): Promise<Record<string, unknown> | null>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
  listConversations(): Promise<Conversation[]>;
  saveConversation(c: Conversation): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  clearConversations(): Promise<void>;
  addHistory(e: HistoryEntry): Promise<void>;
  listHistory(limit?: number): Promise<HistoryEntry[]>;
  deleteHistory(id: string): Promise<void>;
  clearHistory(): Promise<void>;
  addImage(r: ImageRecord): Promise<void>;
  listImages(limit?: number): Promise<ImageRecord[]>;
  deleteImage(id: string): Promise<void>;
  clearImages(): Promise<void>;
}

export const HISTORY_LIMIT = 500;
export const IMAGE_LIMIT = 60;
