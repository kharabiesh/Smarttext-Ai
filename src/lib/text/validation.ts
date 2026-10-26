export const MAX_INPUT_CHARS = 30_000;
export const MAX_CHAT_MESSAGE_CHARS = 20_000;
export const MAX_IMAGE_PROMPT_CHARS = 4_000;

export type ValidationCode = "empty" | "too_long" | "invalid_url" | "insecure_url" | "invalid_model" | "invalid_key";

export class ValidationError extends Error {
  constructor(
    readonly code: ValidationCode,
    readonly limit?: number,
  ) {
    super(code);
    this.name = "ValidationError";
  }
}

export function validateText(text: string, max = MAX_INPUT_CHARS): string {
  const trimmed = text.trim();
  if (!trimmed) throw new ValidationError("empty");
  if (Array.from(trimmed).length > max) throw new ValidationError("too_long", max);
  return trimmed;
}

/** Mirrors the Rust-side rule: https anywhere, http only for loopback (local model servers). */
export function validateBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError("invalid_url");
  }
  if (url.username || url.password || url.search || url.hash) throw new ValidationError("invalid_url");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "https:") return url.toString().replace(/\/$/, "");
  if (url.protocol === "http:" && loopback) return url.toString().replace(/\/$/, "");
  if (url.protocol === "http:") throw new ValidationError("insecure_url");
  throw new ValidationError("invalid_url");
}

export function validateModelId(model: string): string {
  const m = model.trim();
  if (!m || m.length > 120 || !/^[A-Za-z0-9._:\/\-@]+$/.test(m)) throw new ValidationError("invalid_model");
  return m;
}

export function validateApiKeyInput(key: string): string {
  const k = key.trim();
  if (!k || k.length > 1024 || /\s/.test(k)) throw new ValidationError("invalid_key");
  return k;
}
