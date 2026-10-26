import { isTauri, tauriInvoke } from "../platform";
import { AiError, toAiError } from "./errors";
import type { ProviderHttpRequest, ProviderHttpResponse, Transport } from "./types";

/** Desktop: the Rust side attaches the API key from the OS keychain and performs the request. */
export const tauriTransport: Transport = async (request) => {
  try {
    return await tauriInvoke<ProviderHttpResponse>("provider_request", { request });
  } catch (e) {
    throw toAiError(e);
  }
};

/** Browser dev mode: the local Node server (server/index.ts) attaches keys from `.env`. */
export const devServerTransport: Transport = async (request: ProviderHttpRequest) => {
  let res: Response;
  try {
    res = await fetch("/api/provider", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (e) {
    throw toAiError(e);
  }
  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    throw new AiError("network", { detail: "The SmartText dev server is not running (npm run server)." });
  }
  const p = payload as { ok?: boolean; response?: ProviderHttpResponse; error?: { code: string; message?: string } };
  if (p.ok && p.response) return p.response;
  throw toAiError(p.error ?? { code: "unknown" });
};

export function defaultTransport(): Transport {
  return isTauri() ? tauriTransport : devServerTransport;
}
