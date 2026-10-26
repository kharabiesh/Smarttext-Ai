import type { AspectRatio, CompletionRequest, CompletionResult, GeneratedImage, ImageRequest, ProviderId } from "../types";
import type { AiError } from "../errors";

export interface BuiltRequest {
  path: string;
  method: "GET" | "POST";
  body?: unknown;
}

/** A provider adapter translates between SmartText's neutral types and one provider's HTTP API. It does no I/O. */
export interface TextAdapter {
  id: ProviderId;
  buildCompletion(req: CompletionRequest, model: string): BuiltRequest;
  parseCompletion(json: unknown, model: string): CompletionResult;
  buildListModels(): BuiltRequest;
  parseListModels(json: unknown): string[];
  parseError(status: number, body: string, retryAfter?: number | null): AiError;
}

export interface ImageCapabilities {
  negativePrompt: boolean;
  qualities: string[];
  sizes: Record<AspectRatio, string>;
}

export interface ImageAdapter {
  id: ProviderId;
  capabilities(model: string): ImageCapabilities;
  buildImage(req: ImageRequest, model: string): BuiltRequest;
  parseImage(json: unknown, size: string): GeneratedImage;
  parseError(status: number, body: string, retryAfter?: number | null): AiError;
}
