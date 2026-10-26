import { z } from "zod";
import { AiError, errorFromStatus } from "../errors";
import type { CompletionRequest } from "../types";
import type { TextAdapter } from "./adapter";

// Anthropic Messages API (POST /v1/messages) and Models API (GET /v1/models).
const messageSchema = z.object({
  model: z.string().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
  stop_reason: z.string().nullable().optional(),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});
const modelsSchema = z.object({ data: z.array(z.object({ id: z.string() })) });
const errorSchema = z.object({ error: z.object({ message: z.string().optional() }) });

function errorMessage(body: string): string | undefined {
  try {
    const p = errorSchema.safeParse(JSON.parse(body));
    if (p.success) return p.data.error.message;
  } catch {
    /* not JSON */
  }
  return body ? body.slice(0, 200) : undefined;
}

export const anthropicText: TextAdapter = {
  id: "anthropic",
  buildCompletion(req: CompletionRequest, model: string) {
    const body: Record<string, unknown> = {
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (req.system) body.system = req.system;
    return { path: "/messages", method: "POST", body };
  },
  parseCompletion(json: unknown, model: string) {
    const parsed = messageSchema.safeParse(json);
    if (!parsed.success) throw new AiError("invalid_response");
    if (parsed.data.stop_reason === "refusal") throw new AiError("content_filtered");
    // Only text blocks are user-visible output (thinking blocks etc. are ignored).
    const text = parsed.data.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new AiError("empty_result");
    return {
      text,
      model: parsed.data.model ?? model,
      truncated: parsed.data.stop_reason === "max_tokens",
      usage: parsed.data.usage
        ? { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens }
        : undefined,
    };
  },
  buildListModels: () => ({ path: "/models", method: "GET" }),
  parseListModels(json: unknown) {
    const parsed = modelsSchema.safeParse(json);
    if (!parsed.success) throw new AiError("invalid_response");
    return parsed.data.data.map((m) => m.id);
  },
  parseError: (status, body, retryAfter) => errorFromStatus(status, errorMessage(body), retryAfter),
};
