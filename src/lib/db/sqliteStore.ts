import type Database from "@tauri-apps/plugin-sql";
import { HISTORY_LIMIT, IMAGE_LIMIT, type Conversation, type HistoryEntry, type ImageRecord, type Store } from "./types";

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS conversations (
     id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, messages_json TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS history (
     id TEXT PRIMARY KEY, kind TEXT NOT NULL, tool TEXT NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL,
     options_json TEXT, model TEXT, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS history_created ON history(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS images (
     id TEXT PRIMARY KEY, prompt TEXT NOT NULL, aspect TEXT NOT NULL, quality TEXT NOT NULL, style TEXT NOT NULL,
     model TEXT NOT NULL, size TEXT NOT NULL, base64 TEXT NOT NULL, mime_type TEXT NOT NULL, revised_prompt TEXT, created_at INTEGER NOT NULL)`,
];

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
function parseJson<T>(v: unknown, fallback: T): T {
  try {
    return typeof v === "string" ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** SQLite persistence for the desktop app. All statements are parameterised. */
export class SqliteStore implements Store {
  readonly kind = "sqlite" as const;
  private constructor(private readonly db: Database) {}

  static async open(): Promise<SqliteStore> {
    const { default: Db } = await import("@tauri-apps/plugin-sql");
    const db = await Db.load("sqlite:smarttext.db");
    for (const stmt of SCHEMA) await db.execute(stmt);
    return new SqliteStore(db);
  }

  async loadSettings() {
    const rows = await this.db.select<Row[]>("SELECT json FROM settings WHERE id = 1");
    return rows.length ? parseJson<Record<string, unknown> | null>(rows[0].json, null) : null;
  }
  async saveSettings(settings: Record<string, unknown>) {
    await this.db.execute("INSERT INTO settings (id, json) VALUES (1, $1) ON CONFLICT(id) DO UPDATE SET json = excluded.json", [
      JSON.stringify(settings),
    ]);
  }

  async listConversations(): Promise<Conversation[]> {
    const rows = await this.db.select<Row[]>("SELECT * FROM conversations ORDER BY updated_at DESC");
    return rows.map((r) => ({
      id: str(r.id),
      title: str(r.title),
      createdAt: num(r.created_at),
      updatedAt: num(r.updated_at),
      messages: parseJson(r.messages_json, []),
    }));
  }
  async saveConversation(c: Conversation) {
    await this.db.execute(
      `INSERT INTO conversations (id, title, created_at, updated_at, messages_json) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, updated_at = excluded.updated_at, messages_json = excluded.messages_json`,
      [c.id, c.title, c.createdAt, c.updatedAt, JSON.stringify(c.messages)],
    );
  }
  async deleteConversation(id: string) {
    await this.db.execute("DELETE FROM conversations WHERE id = $1", [id]);
  }
  async clearConversations() {
    await this.db.execute("DELETE FROM conversations");
  }

  async addHistory(e: HistoryEntry) {
    await this.db.execute(
      "INSERT INTO history (id, kind, tool, input, output, options_json, model, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [e.id, e.kind, e.tool, e.input, e.output, e.options ? JSON.stringify(e.options) : null, e.model ?? null, e.createdAt],
    );
    await this.db.execute(
      "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT $1)",
      [HISTORY_LIMIT],
    );
  }
  async listHistory(limit = HISTORY_LIMIT): Promise<HistoryEntry[]> {
    const rows = await this.db.select<Row[]>("SELECT * FROM history ORDER BY created_at DESC LIMIT $1", [limit]);
    return rows.map((r) => ({
      id: str(r.id),
      kind: str(r.kind) as HistoryEntry["kind"],
      tool: str(r.tool),
      input: str(r.input),
      output: str(r.output),
      options: parseJson(r.options_json, undefined),
      model: r.model ? str(r.model) : undefined,
      createdAt: num(r.created_at),
    }));
  }
  async deleteHistory(id: string) {
    await this.db.execute("DELETE FROM history WHERE id = $1", [id]);
  }
  async clearHistory() {
    await this.db.execute("DELETE FROM history");
  }

  async addImage(r: ImageRecord) {
    await this.db.execute(
      `INSERT INTO images (id, prompt, aspect, quality, style, model, size, base64, mime_type, revised_prompt, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [r.id, r.prompt, r.aspect, r.quality, r.style, r.model, r.size, r.base64, r.mimeType, r.revisedPrompt ?? null, r.createdAt],
    );
    await this.db.execute("DELETE FROM images WHERE id NOT IN (SELECT id FROM images ORDER BY created_at DESC LIMIT $1)", [IMAGE_LIMIT]);
  }
  async listImages(limit = IMAGE_LIMIT): Promise<ImageRecord[]> {
    const rows = await this.db.select<Row[]>("SELECT * FROM images ORDER BY created_at DESC LIMIT $1", [limit]);
    return rows.map((r) => ({
      id: str(r.id),
      prompt: str(r.prompt),
      aspect: str(r.aspect),
      quality: str(r.quality),
      style: str(r.style),
      model: str(r.model),
      size: str(r.size),
      base64: str(r.base64),
      mimeType: str(r.mime_type),
      revisedPrompt: r.revised_prompt ? str(r.revised_prompt) : undefined,
      createdAt: num(r.created_at),
    }));
  }
  async deleteImage(id: string) {
    await this.db.execute("DELETE FROM images WHERE id = $1", [id]);
  }
  async clearImages() {
    await this.db.execute("DELETE FROM images");
  }
}
