/** Error categories understood by the UI. Every category has a localized message (i18n `errors.*`). */
export type AiErrorCode =
  | "missing_key"
  | "invalid_key"
  | "rate_limited"
  | "timeout"
  | "network"
  | "bad_request"
  | "server_error"
  | "content_filtered"
  | "empty_result"
  | "invalid_response"
  | "not_configured"
  | "invalid_base_url"
  | "keychain_unavailable"
  | "quota_exceeded"
  | "model_not_found"
  | "unknown";

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly retryAfter?: number;
  /** Short provider-supplied detail (already scrubbed of secrets). */
  readonly detail?: string;

  constructor(code: AiErrorCode, opts: { message?: string; status?: number; retryAfter?: number; detail?: string } = {}) {
    super(opts.message ?? code);
    this.name = "AiError";
    this.code = code;
    this.status = opts.status;
    this.retryAfter = opts.retryAfter;
    this.detail = opts.detail;
  }

  get retryable(): boolean {
    return this.code === "rate_limited" || this.code === "server_error" || this.code === "timeout" || this.code === "network";
  }
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_\-]{8,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_\-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._\-]{8,}/gi,
  /(x-api-key["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-]{8,}/gi,
  /(api[_-]?key["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-]{8,}/gi,
];

/** Removes anything that looks like a credential from text that may be displayed or logged. */
export function scrubSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (_m, prefix?: string) => (typeof prefix === "string" ? `${prefix}[REDACTED]` : "[REDACTED]"));
  }
  return out;
}

/** Maps an HTTP status + provider error body into an AiError. */
export function errorFromStatus(status: number, providerMessage?: string, retryAfter?: number | null): AiError {
  const detail = providerMessage ? scrubSecrets(providerMessage).slice(0, 300) : undefined;
  const lower = (providerMessage ?? "").toLowerCase();
  const base = { status, detail, retryAfter: retryAfter ?? undefined };
  if (status === 401 || status === 403) return new AiError("invalid_key", base);
  if (status === 429) {
    if (lower.includes("quota") || lower.includes("billing") || lower.includes("credit")) return new AiError("quota_exceeded", base);
    return new AiError("rate_limited", base);
  }
  if (status === 404) return new AiError("model_not_found", base);
  if (status === 408 || status === 504) return new AiError("timeout", base);
  if (status === 400 || status === 422) {
    if (lower.includes("safety") || lower.includes("content_policy") || lower.includes("moderation")) return new AiError("content_filtered", base);
    return new AiError("bad_request", base);
  }
  if (status >= 500) return new AiError("server_error", base);
  return new AiError("unknown", base);
}

/** Converts transport-level failures (Rust CommandError / fetch errors) into AiError. */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    const e = err as { code: string; message?: string };
    const known: AiErrorCode[] = ["missing_key", "invalid_key", "timeout", "network", "invalid_base_url", "keychain_unavailable", "not_configured"];
    const code = (known as string[]).includes(e.code) ? (e.code as AiErrorCode) : "unknown";
    return new AiError(code, { detail: e.message ? scrubSecrets(e.message) : undefined });
  }
  if (err instanceof Error) {
    if (err.name === "AbortError" || /timed? ?out/i.test(err.message)) return new AiError("timeout");
    if (err instanceof TypeError) return new AiError("network", { detail: scrubSecrets(err.message) });
    return new AiError("unknown", { detail: scrubSecrets(err.message) });
  }
  return new AiError("unknown", { detail: typeof err === "string" ? scrubSecrets(err) : undefined });
}
