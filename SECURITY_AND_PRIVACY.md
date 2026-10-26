# Security and privacy

## Where things live

| Data | Location | Leaves the device? |
|---|---|---|
| API keys (desktop) | OS credential store: macOS Keychain or Windows Credential Manager (Secret Service on Linux), via the Rust `keyring` crate | Only in the request header sent to that provider |
| API keys (browser dev mode) | `.env` read by the local proxy `server/index.ts` | Only in the request header sent to that provider |
| Settings, text history, chat conversations, generated images | Local SQLite file `smarttext.db` in the app config folder (see the install guides) | Never |
| Text and prompts you submit | Sent to the provider you selected | Yes, to that provider only (shown next to every action button, e.g. "api.openai.com · gpt-4.1-mini") |
| Similarity checks | Computed in the app | Never |

## Local application settings vs. server-side secrets

- **Local settings** (language, theme, model ids, history toggles) are ordinary preferences in SQLite. They are not secret and contain no keys.
- **Secrets** (API keys) are never stored in SQLite, `localStorage`, logs or the JavaScript bundle:
  - Desktop: the webview sends the key once to the Rust command `secret_set`, which writes it to the keychain. No command returns a key to the webview: `secret_status` returns only true or false.
  - Each AI request goes through the Rust command `provider_request`. Rust reads the key from the keychain, adds the header and makes the HTTPS call. The webview never holds the key after it is saved.
  - If the credential store cannot be opened, requests to a fixed provider (OpenAI, Anthropic) fail with a clear error. Requests to an OpenAI-compatible server are sent without a key, since local servers usually need none; a server that does need one answers 401.
  - Browser development mode: the Node proxy on `127.0.0.1` adds keys from `.env`. That file is git-ignored, and `.env.example` contains only empty placeholders.

## Network controls

- The webview's Content Security Policy only allows connections to Tauri IPC. It cannot reach provider APIs, or anything else, directly.
- Rust resolves destinations from a fixed allow-list: `https://api.openai.com/v1`, `https://api.anthropic.com/v1`. A custom URL is accepted only for the "OpenAI-compatible server" provider, and it must be `https://`. Plain `http://` is allowed only for `localhost`/`127.0.0.1` (Ollama, LM Studio).
- Request paths are validated: no `..`, no query strings, only safe characters. Only GET and POST are allowed.
- Timeouts are enforced in Rust (1–600 s; default 120 s, configurable). Rate limits (429) and temporary 5xx errors are retried with exponential backoff, and `Retry-After` is honoured.
- Provider response bodies have the key removed before they reach the UI. Error messages are scrubbed again in TypeScript (`scrubSecrets`) before they are displayed or logged.

## Untrusted AI output

- Markdown is rendered with `react-markdown` with `skipHtml`, so raw HTML in model output is not rendered.
- Links are shown as text and never opened automatically. Images in model output are not loaded.
- Code blocks are only displayed and copyable. Nothing generated is ever executed.

## Your controls

Settings → Privacy & data:

- turn off local saving of text history, chat conversations or generated images
- delete text history, conversations or images, or erase all local data
- remove a stored API key (Settings → AI providers → Remove key)

## Third-party processing and costs

Text, chat messages and image prompts are processed by the provider you configure, under that provider's terms and data policies. API usage is billed by the provider to your account. SmartText shows token counts when the provider returns them, but it does not estimate prices.

## Honest limitations

- No AI-text detector is bundled. Detection results from any service are estimates and cannot prove authorship.
- The similarity check compares only the documents you paste. It is not an internet-wide plagiarism search.
- Keychain storage was tested only through unit tests (input validation). Saving a key on a real macOS or Windows keychain still needs testing on those systems.

## Reporting a vulnerability

Please report security issues privately to the maintainer (Ismaiel Almarie) rather than in a public issue.
