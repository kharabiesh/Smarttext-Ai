import { AiError } from "./errors";
import { withRetry, withTimeout } from "./retry";
import { IMAGE_ADAPTERS, TEXT_ADAPTERS } from "./registry";
import type { BuiltRequest } from "./providers/adapter";
import type { CompletionRequest, CompletionResult, GeneratedImage, ImageRequest, ProviderId, Transport } from "./types";

export interface ClientConfig {
  textProvider: ProviderId;
  textModel: string;
  imageProvider: ProviderId | "none";
  imageModel: string;
  compatibleBaseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Provider-independent entry point used by the UI. Adapters build/parse payloads; the transport performs I/O.
 * Retries, timeouts and error mapping live here so every feature behaves the same way.
 */
export class AiClient {
  constructor(
    private readonly transport: Transport,
    private readonly config: () => ClientConfig,
    private readonly sleep?: (ms: number) => Promise<void>,
  ) {}

  private async execute(
    provider: ProviderId,
    built: BuiltRequest,
    parseError: (status: number, body: string, retryAfter?: number | null) => AiError,
  ): Promise<unknown> {
    const cfg = this.config();
    const baseUrl = provider === "openai_compatible" ? cfg.compatibleBaseUrl : undefined;
    if (provider === "openai_compatible" && !baseUrl) throw new AiError("not_configured");
    return withRetry(
      async () => {
        const res = await withTimeout(
          this.transport({ provider, baseUrl, path: built.path, method: built.method, body: built.body, timeoutMs: cfg.timeoutMs }),
          cfg.timeoutMs + 5_000,
        );
        if (res.status >= 400) throw parseError(res.status, res.body, res.retryAfter);
        try {
          return JSON.parse(res.body) as unknown;
        } catch {
          throw new AiError("invalid_response");
        }
      },
      { maxRetries: cfg.maxRetries, sleep: this.sleep },
    );
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const cfg = this.config();
    const adapter = TEXT_ADAPTERS[cfg.textProvider];
    if (!cfg.textModel.trim()) throw new AiError("not_configured");
    const json = await this.execute(cfg.textProvider, adapter.buildCompletion(req, cfg.textModel.trim()), adapter.parseError);
    return adapter.parseCompletion(json, cfg.textModel);
  }

  async listModels(provider: ProviderId): Promise<string[]> {
    const adapter = TEXT_ADAPTERS[provider];
    const json = await this.execute(provider, adapter.buildListModels(), adapter.parseError);
    return adapter.parseListModels(json);
  }

  async generateImage(req: ImageRequest): Promise<GeneratedImage> {
    const cfg = this.config();
    if (cfg.imageProvider === "none") throw new AiError("not_configured");
    const adapter = IMAGE_ADAPTERS[cfg.imageProvider];
    if (!adapter) throw new AiError("not_configured");
    const built = adapter.buildImage(req, cfg.imageModel);
    const size = adapter.capabilities(cfg.imageModel).sizes[req.aspect];
    const json = await this.execute(cfg.imageProvider, built, adapter.parseError);
    return adapter.parseImage(json, size);
  }
}
