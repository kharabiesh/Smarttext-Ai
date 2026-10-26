/**
 * Browser development mode only: a local proxy that mirrors the Rust `provider_request` command.
 * API keys come from environment variables (.env) and are never sent to the browser.
 */

export type ProviderId = "openai" | "anthropic" | "openai_compatible";

export interface ProxyRequest {
  provider: string;
  baseUrl?: string;
  path: string;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
}

export class ProxyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FIXED_BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

export function keyFor(provider: ProviderId, env: NodeJS.ProcessEnv): string | undefined {
  const v = { openai: env.OPENAI_API_KEY, anthropic: env.ANTHROPIC_API_KEY, openai_compatible: env.OPENAI_COMPATIBLE_API_KEY }[provider];
  return v && v.trim() ? v.trim() : undefined;
}

export function parseProvider(id: string): ProviderId {
  if (id === "openai" || id === "anthropic" || id === "openai_compatible") return id;
  throw new ProxyError("unknown_provider", `Unknown provider '${id}'.`);
}

export function validatePath(path: string) {
  if (!/^\/[A-Za-z0-9/_.\-]{0,199}$/.test(path) || path.includes("..") || path.includes("//")) {
    throw new ProxyError("invalid_path", "The request path is not allowed.");
  }
}

export function validateCustomBase(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ProxyError("invalid_base_url", "The server URL is not a valid URL.");
  }
  if (url.username || url.password || url.search || url.hash) throw new ProxyError("invalid_base_url", "The server URL must not contain credentials, query or fragment.");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "https:" || (url.protocol === "http:" && loopback)) return url.toString().replace(/\/$/, "");
  throw new ProxyError("invalid_base_url", "Use https:// for remote servers (http:// is only allowed for localhost).");
}

export function resolveUrl(provider: ProviderId, baseUrl: string | undefined, path: string): string {
  validatePath(path);
  const base = FIXED_BASE[provider] ?? (baseUrl ? validateCustomBase(baseUrl) : undefined);
  if (!base) throw new ProxyError("invalid_base_url", "No server URL is configured.");
  return `${base.replace(/\/$/, "")}${path}`;
}

export function redact(text: string, key?: string): string {
  return key && key.length >= 6 ? text.split(key).join("[REDACTED]") : text;
}

export async function forward(req: ProxyRequest, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const provider = parseProvider(req.provider);
  const url = resolveUrl(provider, req.baseUrl, req.path);
  const key = keyFor(provider, env);
  if (!key && provider !== "openai_compatible") throw new ProxyError("missing_key", "No API key is configured in .env for this provider.");
  const method = req.method ?? "POST";
  if (method !== "GET" && method !== "POST") throw new ProxyError("invalid_method", "Only GET and POST are allowed.");
  const timeout = Math.min(600_000, Math.max(1_000, req.timeoutMs ?? 120_000));
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "SmartTextAI-dev" };
  if (provider === "anthropic") {
    headers["anthropic-version"] = "2023-06-01";
    if (key) headers["x-api-key"] = key;
  } else if (key) {
    headers.authorization = `Bearer ${key}`;
  }
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(req.body ?? null) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") throw new ProxyError("timeout", `The provider did not respond within ${Math.round(timeout / 1000)} seconds.`);
    throw new ProxyError("network", "Could not connect to the provider.");
  }
  const retryAfterRaw = Number(res.headers.get("retry-after"));
  return {
    status: res.status,
    body: redact(await res.text(), key),
    retryAfter: Number.isFinite(retryAfterRaw) && res.headers.get("retry-after") !== null ? retryAfterRaw : null,
  };
}
