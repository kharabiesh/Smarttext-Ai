import { secrets } from "@/lib/ai/secrets";
import { logger } from "@/lib/logger";
import { useSettings } from "./settings";

/** Re-reads which providers have a stored key (booleans only) into the settings store. */
export function refreshKeyStatus() {
  return secrets
    .status()
    .then((s) => useSettings.getState().setKeyStatus(s))
    .catch((e) => logger.warn("Could not read key status", e));
}
