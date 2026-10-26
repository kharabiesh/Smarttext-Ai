import { isTauri, tauriInvoke } from "../platform";
import { toAiError } from "./errors";
import type { ProviderId } from "./types";

export type KeyStatus = Record<ProviderId, boolean>;

/**
 * Credential management. On desktop, keys go straight to the OS keychain via Rust and are never read back.
 * In browser dev mode keys come from the server's `.env` file and cannot be changed from the UI.
 */
export const secrets = {
  canEdit(): boolean {
    return isTauri();
  },
  async status(): Promise<KeyStatus> {
    if (isTauri()) return tauriInvoke<KeyStatus>("secret_status");
    try {
      const res = await fetch("/api/secrets/status");
      if (!res.ok) throw new Error("status");
      return (await res.json()) as KeyStatus;
    } catch {
      return { openai: false, anthropic: false, openai_compatible: false };
    }
  },
  async set(provider: ProviderId, key: string): Promise<void> {
    if (!isTauri()) throw toAiError({ code: "not_configured", message: "Set keys in the .env file in browser dev mode." });
    try {
      await tauriInvoke("secret_set", { provider, key });
    } catch (e) {
      throw toAiError(e);
    }
  },
  async remove(provider: ProviderId): Promise<void> {
    if (!isTauri()) throw toAiError({ code: "not_configured" });
    try {
      await tauriInvoke("secret_delete", { provider });
    } catch (e) {
      throw toAiError(e);
    }
  },
};
