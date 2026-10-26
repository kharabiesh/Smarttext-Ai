#!/usr/bin/env node
/**
 * MOCK OpenAI-compatible server for automated end-to-end tests and documentation screenshots.
 * It returns fixed, clearly-canned responses — it is NOT an AI model. Never use it as a real provider.
 *
 *   node scripts/mock/mock-provider.mjs [port]   (default 18080)
 * Then set Settings → AI providers → OpenAI-compatible server → http://127.0.0.1:18080/v1
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 18080);

const CANNED = {
  humanizerEn:
    "Clear communication with customers matters more than ever. Yet many companies still send long, confusing emails — and customers often skip them. In our 2025 survey of 1,200 customers, 64% said they prefer shorter messages. Companies that keep their messages short and clear will give their customers a better experience.",
  humanizerAr:
    "أصبح التواصل الواضح مع العملاء أهم من أي وقت مضى في عالمنا المتسارع. ومع ذلك، ما زالت شركات كثيرة ترسل رسائل بريد طويلة ومربكة، فيتجاهلها العملاء في الغالب. وفي استطلاعنا الذي شمل 1,200 عميل عام 2025، أفاد 64% منهم بأنهم يفضّلون الرسائل الأقصر. لذا ينبغي للشركات أن تحرص على أن تكون رسائلها موجزة وواضحة لتحسين تجربة عملائها.",
  summaryEn:
    "- Clear communication with customers is essential.\n- Many companies send long, confusing emails that customers ignore.\n- A 2025 survey of 1,200 customers found 64% prefer shorter messages.\n- Shorter, clearer messages improve the customer experience.",
  summaryAr:
    "- التواصل الواضح مع العملاء أمر ضروري.\n- ترسل شركات كثيرة رسائل طويلة ومربكة يتجاهلها العملاء.\n- وجد استطلاع عام 2025 شمل 1,200 عميل أن 64% يفضّلون الرسائل الأقصر.\n- الرسائل الأقصر والأوضح تحسّن تجربة العملاء.",
  chatEn:
    "Here are three ways to make customer emails clearer:\n\n1. **Lead with the action** — put what you need from the reader in the first sentence.\n2. **One topic per email** — split unrelated requests.\n3. **Use short paragraphs** — two or three sentences each.\n\nA simple template:\n\n```text\nSubject: [Action] by [date]\n\nHi [Name],\n[One-sentence request]\n[Context in 2–3 sentences]\nThanks,\n[You]\n```",
  chatAr:
    "إليك ثلاث طرق لجعل رسائل العملاء أوضح:\n\n1. **ابدأ بالمطلوب** — ضع ما تحتاجه من القارئ في الجملة الأولى.\n2. **موضوع واحد لكل رسالة** — افصل الطلبات غير المترابطة.\n3. **فقرات قصيرة** — جملتان أو ثلاث لكل فقرة.\n\nقالب بسيط:\n\n```text\nSubject: [Action] by [date]\n```",
};

const arabic = (s) => /[؀-ۿ]/.test(s);

function reply(messages) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const ar = arabic(user);
  if (system.startsWith("You are an expert editor")) return ar ? CANNED.humanizerAr : CANNED.humanizerEn;
  if (system.startsWith("Summarize") || system.startsWith("Extract the main points")) return ar ? CANNED.summaryAr : CANNED.summaryEn;
  if (system.startsWith("You are SmartText AI")) return ar ? CANNED.chatAr : CANNED.chatEn;
  return `[MOCK RESPONSE] ${user.slice(0, 400)}`;
}

createServer((req, res) => {
  const send = (status, obj) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "GET" && req.url === "/v1/models") return send(200, { object: "list", data: [{ id: "mock-model" }, { id: "mock-model-large" }] });
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      if (parsed.model === "mock-error-429") return send(429, { error: { message: "Rate limit reached (mock)" } });
      const text = reply(parsed.messages ?? []);
      setTimeout(
        () =>
          send(200, {
            id: "mock",
            object: "chat.completion",
            model: parsed.model,
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
            usage: { prompt_tokens: Math.ceil(body.length / 4), completion_tokens: Math.ceil(text.length / 4) },
          }),
        350,
      );
    });
    return;
  }
  send(404, { error: { message: "not found (mock)" } });
}).listen(PORT, "127.0.0.1", () => console.log(`MOCK provider on http://127.0.0.1:${PORT}/v1`));
