import { scrubSecrets } from "./ai/errors";

/** Minimal logger that scrubs anything resembling a credential before writing to the console. */
function fmt(args: unknown[]): string[] {
  return args.map((a) => scrubSecrets(typeof a === "string" ? a : a instanceof Error ? `${a.name}: ${a.message}` : safeJson(a)));
}
function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
export const logger = {
  info: (...args: unknown[]) => console.info("[SmartText]", ...fmt(args)),
  warn: (...args: unknown[]) => console.warn("[SmartText]", ...fmt(args)),
  error: (...args: unknown[]) => console.error("[SmartText]", ...fmt(args)),
};
