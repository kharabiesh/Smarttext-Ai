import { z } from "zod";
import { AiError, errorFromStatus } from "../errors";
import type { CompletionRequest, ImageRequest, ProviderId } from "../types";
import type { BuiltRequest, ImageAdapter, ImageCapabilities, TextAdapter } from "./adapter";
import { stylePromptSuffix } from "../imageStyles";

// Response shapes follow the OpenAI Chat Completions, Models and Images APIs.
const chatSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional(), refusal: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  model: z.string().optional(),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).nullable().optional(),
});

const modelsSchema = z.object({ data: z.array(z.object({ id: z.string() })) });

const imageSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().optional(), revised_prompt: z.string().nullable().optional() })).min(1),
});

const errorSchema = z.object({ error: z.object({ message: z.string().optional() }).passthrough() }).passthrough();

export function openAiErrorMessage(body: string): string | undefined {
  try {
    const parsed = errorSchema.safeParse(JSON.parse(body));
    if (parsed.success) return parsed.data.error.message;
  } catch {
    /* not JSON */
  }
  return body ? body.slice(0, 200) : undefined;
}

function makeTextAdapter(id: ProviderId, tokenField: "max_completion_tokens" | "max_tokens"): TextAdapter {
  return {
    id,
    buildCompletion(req: CompletionRequest, model: string): BuiltRequest {
      const messages = [
        ...(req.system ? [{ role: "system", content: req.system }] : []),
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      return { path: "/chat/completions", method: "POST", body: { model, messages, [tokenField]: req.maxTokens ?? 4096 } };
    },
    parseCompletion(json: unknown, model: string) {
      const parsed = chatSchema.safeParse(json);
      if (!parsed.success) throw new AiError("invalid_response");
      const choice = parsed.data.choices[0];
      if (choice.message.refusal) throw new AiError("content_filtered", { detail: choice.message.refusal.slice(0, 300) });
      const text = (choice.message.content ?? "").trim();
      if (choice.finish_reason === "content_filter") throw new AiError("content_filtered");
      if (!text) throw new AiError("empty_result");
      return {
        text,
        model: parsed.data.model ?? model,
        truncated: choice.finish_reason === "length",
        usage: parsed.data.usage
          ? { inputTokens: parsed.data.usage.prompt_tokens, outputTokens: parsed.data.usage.completion_tokens }
          : undefined,
      };
    },
    buildListModels: () => ({ path: "/models", method: "GET" }),
    parseListModels(json: unknown) {
      const parsed = modelsSchema.safeParse(json);
      if (!parsed.success) throw new AiError("invalid_response");
      return parsed.data.data.map((m) => m.id).sort();
    },
    parseError: (status, body, retryAfter) => errorFromStatus(status, openAiErrorMessage(body), retryAfter),
  };
}

export const openAiText = makeTextAdapter("openai", "max_completion_tokens");
/** Ollama, LM Studio, OpenRouter, vLLM… implement the same Chat Completions shape; most expect `max_tokens`. */
export const openAiCompatibleText = makeTextAdapter("openai_compatible", "max_tokens");

const GPT_IMAGE: ImageCapabilities = {
  negativePrompt: false,
  qualities: ["auto", "low", "medium", "high"],
  sizes: { square: "1024x1024", landscape: "1536x1024", portrait: "1024x1536" },
};
const DALLE3: ImageCapabilities = {
  negativePrompt: false,
  qualities: ["standard", "hd"],
  sizes: { square: "1024x1024", landscape: "1792x1024", portrait: "1024x1792" },
};

export const openAiImage: ImageAdapter = {
  id: "openai",
  capabilities: (model) => (model.startsWith("dall-e-3") ? DALLE3 : GPT_IMAGE),
  buildImage(req: ImageRequest, model: string): BuiltRequest {
    const caps = this.capabilities(model);
    const size = caps.sizes[req.aspect];
    const quality = caps.qualities.includes(req.quality) ? req.quality : caps.qualities[0];
    const prompt = `${req.prompt.trim()}${stylePromptSuffix(req.style)}`;
    const body: Record<string, unknown> = { model, prompt, size, quality, n: 1 };
    // gpt-image models always return base64; DALL·E 3 needs it requested explicitly.
    if (model.startsWith("dall-e")) body.response_format = "b64_json";
    return { path: "/images/generations", method: "POST", body };
  },
  parseImage(json: unknown, size: string) {
    const parsed = imageSchema.safeParse(json);
    if (!parsed.success) throw new AiError("invalid_response");
    const first = parsed.data.data[0];
    if (!first.b64_json) throw new AiError("empty_result");
    return { base64: first.b64_json, mimeType: "image/png", revisedPrompt: first.revised_prompt ?? undefined, size };
  },
  parseError: (status, body, retryAfter) => errorFromStatus(status, openAiErrorMessage(body), retryAfter),
};
