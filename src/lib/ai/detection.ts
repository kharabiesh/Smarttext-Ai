/**
 * Integration boundary for optional AI-text detection services.
 *
 * SmartText ships NO detection provider and never fabricates scores. To add one, implement this interface
 * against a service with a documented API, register it in DETECTION_PROVIDERS, and route its HTTP calls
 * through the Rust `provider_request` command (add the host to the allow-list there).
 */
export interface DetectionResult {
  providerName: string;
  /** Exactly as documented by the provider, e.g. probability that the text is AI-generated (0–1). */
  score: number;
  /** The provider's own label/interpretation, shown verbatim. */
  label?: string;
  raw: unknown;
}

export interface DetectionProvider {
  id: string;
  name: string;
  /** Host the text is sent to, shown to the user before submitting. */
  host: string;
  detect(text: string): Promise<DetectionResult>;
}

export const DETECTION_PROVIDERS: DetectionProvider[] = [];
