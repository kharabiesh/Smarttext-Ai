export type ProviderId = "openai" | "anthropic" | "openai_compatible";
export const PROVIDER_IDS: ProviderId[] = ["openai", "anthropic", "openai_compatible"];

export type ChatRole = "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  system?: string;
  messages: ChatTurn[];
  maxTokens?: number;
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage?: Usage;
  /** Provider reported the output was cut short (e.g. max tokens reached). */
  truncated?: boolean;
}

export interface ImageRequest {
  prompt: string;
  negativePrompt?: string;
  aspect: AspectRatio;
  quality: string;
  style: string;
}
export type AspectRatio = "square" | "landscape" | "portrait";

export interface GeneratedImage {
  /** PNG/JPEG/WebP data as base64 (no data: prefix). */
  base64: string;
  mimeType: string;
  revisedPrompt?: string;
  size: string;
}

/** HTTP request description handed to the transport (Tauri/Rust or the dev server). */
export interface ProviderHttpRequest {
  provider: ProviderId;
  baseUrl?: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

export interface ProviderHttpResponse {
  status: number;
  body: string;
  retryAfter?: number | null;
}

export type Transport = (req: ProviderHttpRequest) => Promise<ProviderHttpResponse>;

export interface ProviderSettings {
  baseUrl?: string;
}
