import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { forward, keyFor, ProxyError } from "./providerProxy";

const PORT = Number(process.env.SMARTTEXT_SERVER_PORT ?? 8787);
const MAX_BODY = 2 * 1024 * 1024;

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ProxyError("too_large", "Request body too large."));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  // Only same-origin requests proxied by Vite are expected; reject cross-site browser requests.
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):(1420|4173)$/.test(origin)) return send(res, 403, { ok: false, error: { code: "forbidden" } });

  if (req.method === "GET" && req.url === "/api/secrets/status") {
    return send(res, 200, {
      openai: !!keyFor("openai", process.env),
      anthropic: !!keyFor("anthropic", process.env),
      openai_compatible: !!keyFor("openai_compatible", process.env),
    });
  }
  if (req.method === "POST" && req.url === "/api/provider") {
    try {
      const response = await forward(JSON.parse(await readBody(req)), process.env);
      return send(res, 200, { ok: true, response });
    } catch (e) {
      const err = e instanceof ProxyError ? { code: e.code, message: e.message } : { code: "unknown", message: "Unexpected server error." };
      return send(res, 200, { ok: false, error: err });
    }
  }
  send(res, 404, { ok: false, error: { code: "not_found" } });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`SmartText dev server listening on http://127.0.0.1:${PORT} (keys loaded from .env: ${["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_COMPATIBLE_API_KEY"].filter((k) => process.env[k]).join(", ") || "none"})`);
});
