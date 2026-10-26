import { AiClient } from "@/lib/ai/client";
import { defaultTransport } from "@/lib/ai/transport";
import type { Transport } from "@/lib/ai/types";
import { useSettings } from "./settings";

let transport: Transport = defaultTransport();

/** The single AI client, reading the live settings on every call. */
export const ai = new AiClient(
  (req) => transport(req),
  () => {
    const s = useSettings.getState().settings;
    return {
      textProvider: s.textProvider,
      textModel: s.textModels[s.textProvider],
      imageProvider: s.imageProvider,
      imageModel: s.imageModel,
      compatibleBaseUrl: s.compatibleBaseUrl.trim() || undefined,
      timeoutMs: s.timeoutSec * 1000,
      maxRetries: s.maxRetries,
    };
  },
);

/** Test hook: swap the transport for a mock. */
export function setTransportForTests(t: Transport) {
  transport = t;
}
