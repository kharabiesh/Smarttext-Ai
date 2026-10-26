import { isTauri } from "../platform";
import { logger } from "../logger";
import { MemoryStore } from "./memoryStore";
import type { Store } from "./types";

let current: Store | null = null;

/** Opens the platform store once. Falls back to memory if SQLite cannot be opened (reported in Settings). */
export async function openStore(): Promise<Store> {
  if (current) return current;
  if (isTauri()) {
    try {
      const { SqliteStore } = await import("./sqliteStore");
      current = await SqliteStore.open();
      return current;
    } catch (e) {
      logger.error("SQLite unavailable, using in-memory storage", e);
    }
  }
  current = new MemoryStore(isTauri() ? undefined : "smarttext-dev-store");
  return current;
}

export function setStoreForTests(store: Store | null) {
  current = store;
}

export * from "./types";
