import type { ProviderId } from "./types";
import type { ImageAdapter, TextAdapter } from "./providers/adapter";
import { openAiCompatibleText, openAiImage, openAiText } from "./providers/openai";
import { anthropicText } from "./providers/anthropic";

export const TEXT_ADAPTERS: Record<ProviderId, TextAdapter> = {
  openai: openAiText,
  anthropic: anthropicText,
  openai_compatible: openAiCompatibleText,
};

export const IMAGE_ADAPTERS: Partial<Record<ProviderId, ImageAdapter>> = {
  openai: openAiImage,
};

/** Suggested model ids. Users can type any id or load the live list from the provider ("Load models"). */
export const SUGGESTED_TEXT_MODELS: Record<ProviderId, string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  openai_compatible: ["llama3.1", "qwen2.5", "mistral"],
};
export const SUGGESTED_IMAGE_MODELS = ["gpt-image-1", "dall-e-3"];

export const DEFAULT_TEXT_MODEL: Record<ProviderId, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-opus-5-5",
  openai_compatible: "llama3.1",
};

/** Host shown to the user before text leaves the device. */
export function providerHost(id: ProviderId, baseUrl?: string): string {
  if (id === "openai") return "api.openai.com";
  if (id === "anthropic") return "api.anthropic.com";
  try {
    return baseUrl ? new URL(baseUrl).host : "—";
  } catch {
    return "—";
  }
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  openai_compatible: "OpenAI-compatible server",
};
