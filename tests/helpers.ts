import type { ProviderHttpRequest, ProviderHttpResponse, Transport } from "@/lib/ai/types";

/** MOCK transport: records requests and replies from a queue (or a function). Used instead of real providers. */
export function mockTransport(responses: Array<ProviderHttpResponse | Error | ((r: ProviderHttpRequest) => ProviderHttpResponse)>) {
  const calls: ProviderHttpRequest[] = [];
  const transport: Transport = async (req) => {
    calls.push(req);
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(req) : next;
  };
  return { transport, calls };
}

export const ok = (body: unknown): ProviderHttpResponse => ({ status: 200, body: JSON.stringify(body) });
export const openAiChat = (text: string, finish = "stop") =>
  ok({ model: "gpt-test", choices: [{ message: { content: text }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
