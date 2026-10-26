import { AiError, toAiError } from "./errors";

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, err: AiError, delayMs: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Retries rate-limit, timeout, network and 5xx failures with exponential backoff.
 * Honours a provider `retry-after` hint when present. Non-retryable errors are thrown immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs = 800, maxDelayMs = 20_000, sleep = defaultSleep, onRetry } = opts;
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (raw) {
      const err = toAiError(raw);
      if (!err.retryable || attempt >= maxRetries) throw err;
      attempt += 1;
      const hinted = err.retryAfter !== undefined ? err.retryAfter * 1000 : undefined;
      const backoff = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.min(maxDelayMs, hinted ?? backoff);
      onRetry?.(attempt, err, delay);
      await sleep(delay);
    }
  }
}

/** Rejects with a timeout AiError if `promise` does not settle in time (safety net on top of the transport timeout). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new AiError("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
