# SmartText AI technical guide

## 1. Architecture

```
┌──────────────────────── Webview (React + TypeScript) ────────────────────────┐
│ pages/*  ──►  state/* (zustand)  ──►  lib/ai/client.ts (AiClient)             │
│                                         │  builds payloads with adapters      │
│                                         │  lib/ai/providers/{openai,anthropic}│
│                                         ▼                                     │
│                              lib/ai/transport.ts  (Transport interface)       │
└───────────────┬──────────────────────────────────────────┬────────────────────┘
                │ desktop: Tauri IPC                        │ browser dev: fetch /api/provider
                ▼                                           ▼
   src-tauri/src/provider.rs                      server/providerProxy.ts
   - fixed host allow-list                        - same rules, keys from .env
   - key from OS keychain (secrets.rs)
   - timeout, redaction
                │                                           │
                └──────────────► HTTPS to provider ◄────────┘
```

- **Adapters** (`TextAdapter`, `ImageAdapter` in `lib/ai/providers/adapter.ts`) are pure functions. They build the request body, parse the response with **zod** schemas and map HTTP errors into `AiError` codes. They do no I/O, so they are fully unit-tested.
- **AiClient** (`lib/ai/client.ts`) chooses the adapter from settings and applies retries (`withRetry`: 429, 5xx, timeouts, network; honours `Retry-After`) and a timeout safety net. It converts transport failures into `AiError`.
- **Transport** is a single function `(ProviderHttpRequest) => ProviderHttpResponse`. Tests replace it with a mock (`tests/helpers.ts`).
- **Persistence** uses the `Store` interface (`lib/db/types.ts`): `SqliteStore` (desktop, `@tauri-apps/plugin-sql`, parameterised SQL) and `MemoryStore` (browser dev mode, mirrored to localStorage without images, and tests).
- **Localization**: `i18n/en.ts` defines the keys, and `ar.ts` is type-checked against them. `tests/i18n.test.ts` checks that the key sets match, that placeholders match, and that Arabic values really are Arabic. `<html dir>` switches between `rtl` and `ltr`. Layout uses logical CSS properties (`ms-*`, `ps-*`, `start/end`), so mirroring is automatic. User text fields use first-strong-character direction detection (`lib/text/direction.ts`) for mixed Arabic/English.

## 2. Folder map

See the README. Key files:

| File | Purpose |
|---|---|
| `src/lib/ai/prompts.ts` | Humanizer prompt (styles, strength, meaning preservation) and chat system prompt |
| `src/lib/ai/tools.ts` | The 12 writing tools: options plus prompt builders |
| `src/lib/ai/registry.ts` | Adapter registry, suggested models, provider hosts |
| `src/lib/ai/detection.ts` | Interface for optional AI-detection providers (none bundled) |
| `src/lib/text/similarity.ts` | Local similarity: 3-word shingles, containment, cosine, shared passages, Arabic normalization |
| `src-tauri/src/provider.rs` | Outbound request proxy (allow-list, headers, timeout, redaction) |
| `src-tauri/src/secrets.rs` | Keychain set, delete and status (never get) |
| `src-tauri/src/files.rs` | Native "Save as" dialog and write (the webview cannot choose arbitrary paths) |
| `src-tauri/tauri.conf.json` | Window, CSP and bundle settings (dmg, msi, nsis…) |
| `src-tauri/capabilities/default.json` | Tauri permissions (core, sql, dialog only) |

## 3. Commands

| Task | Command |
|---|---|
| Install | `npm ci` |
| Desktop development | `npm run tauri dev` |
| Browser development (proxy + Vite) | `cp .env.example .env && npm run dev:web` |
| Unit, integration and UI tests | `npm test` |
| Type check | `npm run typecheck` |
| Rust tests | `cd src-tauri && cargo test` |
| E2E + screenshots (mock server) | `node scripts/manual/capture-screenshots.mjs` |
| Mock provider only | `node scripts/mock/mock-provider.mjs 18080` |
| Build installers | `npm run tauri build` (see INSTALL_MACOS.md / INSTALL_WINDOWS.md) |
| Regenerate icons | `npm run icons` (from `assets/logo-1024.png`) |
| Rebuild the Arabic PDF manual | `npm run screenshots && npm run manual` |

## 4. Adding an AI provider

Example: a provider with its own HTTP API, called "acme".

1. **Rust** (`src-tauri/src/provider.rs`): add `ProviderKind::Acme`, its id `"acme"`, its fixed base URL in `fixed_base`, and its auth header in `send`. Add it to `ProviderKind::ALL` so `secret_status` reports it. Add a unit test for `resolve_url`.
2. **Dev proxy** (`server/providerProxy.ts`): add the same base URL, the env var (`ACME_API_KEY`) and the header. Add the variable to `.env.example`.
3. **TypeScript**: extend `ProviderId` in `lib/ai/types.ts`. Write `lib/ai/providers/acme.ts` implementing `TextAdapter`, with zod schemas taken from the provider's official API reference. Register it in `TEXT_ADAPTERS`, `SUGGESTED_TEXT_MODELS`, `DEFAULT_TEXT_MODEL`, `PROVIDER_LABEL` and `providerHost`.
4. **i18n**: add `settings.providerNames.acme` and `settings.providerHelp.acme` to `en.ts` and `ar.ts`.
5. **Tests**: add adapter tests with mocked payloads, following `tests/adapters.test.ts`.

If the service already speaks the OpenAI Chat Completions format, you need no code: choose **OpenAI-compatible server** in Settings and enter its URL.

### Adding an image provider

Implement `ImageAdapter` (capabilities: sizes per aspect, qualities, negative-prompt support). Register it in `IMAGE_ADAPTERS` and add the option to Settings → Image generation. The image page reads `capabilities()` to enable or disable controls.

### Adding an AI-detection provider

Implement `DetectionProvider` in `lib/ai/detection.ts` against a service with a **documented** API, and route its HTTP calls through `provider_request` (add its host to the Rust allow-list). Display the score exactly as the provider defines it, together with the provider's name. Never compute or invent scores locally.

## 5. Data model (SQLite)

`settings(id=1, json)`, `conversations(id, title, created_at, updated_at, messages_json)`, `history(id, kind, tool, input, output, options_json, model, created_at)`, `images(id, prompt, aspect, quality, style, model, size, base64, mime_type, revised_prompt, created_at)`. History is capped at 500 rows and images at 60. The schema is created with `CREATE TABLE IF NOT EXISTS` on start-up.

## 6. Error handling

Every failure becomes an `AiError` with a code. The UI shows the localized message `errors.<code>`, plus the provider's own message after it has been scrubbed of secrets. Configuration errors offer an **Open Settings** button, and retryable errors offer **Try again**.

| Code | Typical cause |
|---|---|
| `missing_key` | No key saved for the selected provider |
| `invalid_key` | HTTP 401/403 |
| `rate_limited` / `quota_exceeded` | HTTP 429 (quota/billing wording → quota_exceeded) |
| `timeout` | No response within the configured timeout |
| `network` | DNS, connection or TLS failure |
| `model_not_found` | HTTP 404 (wrong model id or URL) |
| `content_filtered` | Refusal or safety rejection |
| `invalid_base_url` | Custom URL not https (or http on a non-loopback host) |
| `keychain_unavailable` | OS credential store locked or unavailable |

## 7. Troubleshooting (developers)

| Symptom | Fix |
|---|---|
| `npm run tauri dev` stops with `frontendDist … doesn't exist` | Run `npm run build` once, or start through `tauri dev`, which runs Vite first. |
| Linux: `webkit2gtk-4.1 not found` | `sudo apt install libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev libdbus-1-dev` |
| Browser mode says "dev server is not running" | `npm run server` (or `npm run dev:web`) |
| Ollama returns `model_not_found` | `ollama pull llama3.1`, and use base URL `http://localhost:11434/v1` |
| Tests fail on `Arabic strings are actually translated` | A new `ar.ts` value is still English. Translate it. |

## 8. Release process

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` (a test checks they match).
2. `npm test && (cd src-tauri && cargo test)`
3. Push a tag `vX.Y.Z`. The **Release builds** workflow builds the macOS arm64/x64 DMGs and the Windows MSI/NSIS installers, then publishes a GitHub release with them attached. Without pushing a tag, run the workflow from the Actions tab and fill in **release_tag** (for example `v1.0.0`); leave it empty to only build (installers are then available as workflow artifacts).
