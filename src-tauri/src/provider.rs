//! Outbound requests to AI providers.
//!
//! The webview builds the JSON body (provider adapters live in TypeScript), but it cannot choose
//! arbitrary hosts and never sees API keys: this module resolves the destination from a fixed
//! allow-list, attaches the key from the OS credential store, enforces a timeout and strips the
//! key from anything returned.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use url::Url;

use crate::error::CommandError;
use crate::secrets;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderKind {
    OpenAi,
    Anthropic,
    OpenAiCompatible,
}

impl ProviderKind {
    pub const ALL: [ProviderKind; 3] = [ProviderKind::OpenAi, ProviderKind::Anthropic, ProviderKind::OpenAiCompatible];

    pub fn parse(id: &str) -> Result<Self, CommandError> {
        match id {
            "openai" => Ok(Self::OpenAi),
            "anthropic" => Ok(Self::Anthropic),
            "openai_compatible" => Ok(Self::OpenAiCompatible),
            _ => Err(CommandError::new("unknown_provider", format!("Unknown provider '{id}'."))),
        }
    }

    pub fn id(self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::Anthropic => "anthropic",
            Self::OpenAiCompatible => "openai_compatible",
        }
    }

    fn fixed_base(self) -> Option<&'static str> {
        match self {
            Self::OpenAi => Some("https://api.openai.com/v1"),
            Self::Anthropic => Some("https://api.anthropic.com/v1"),
            Self::OpenAiCompatible => None,
        }
    }

    /// OpenAI-compatible servers (Ollama, LM Studio…) often run locally without a key.
    fn key_required(self) -> bool {
        !matches!(self, Self::OpenAiCompatible)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHttpRequest {
    pub provider: String,
    pub base_url: Option<String>,
    pub path: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(default)]
    pub body: Option<serde_json::Value>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub body: String,
    pub retry_after: Option<f64>,
}

const MIN_TIMEOUT_MS: u64 = 1_000;
const MAX_TIMEOUT_MS: u64 = 600_000;
const DEFAULT_TIMEOUT_MS: u64 = 120_000;

fn validate_path(path: &str) -> Result<(), CommandError> {
    let ok = path.starts_with('/')
        && !path.contains("..")
        && !path.contains("//")
        && path.len() <= 200
        && path.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '-' | '_' | '.'));
    if ok {
        Ok(())
    } else {
        Err(CommandError::new("invalid_path", "The request path is not allowed."))
    }
}

/// Custom base URLs are only allowed for OpenAI-compatible servers. They must be HTTPS,
/// except for loopback addresses (local servers such as Ollama or LM Studio).
pub fn validate_custom_base(raw: &str) -> Result<Url, CommandError> {
    let url = Url::parse(raw.trim()).map_err(|_| CommandError::new("invalid_base_url", "The server URL is not a valid URL."))?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(CommandError::new("invalid_base_url", "Put credentials in the API key field, not in the URL."));
    }
    if url.query().is_some() || url.fragment().is_some() {
        return Err(CommandError::new("invalid_base_url", "The server URL must not contain a query string or fragment."));
    }
    let host = url.host_str().unwrap_or_default();
    let loopback = matches!(host, "localhost" | "127.0.0.1" | "[::1]" | "::1");
    match url.scheme() {
        "https" => Ok(url),
        "http" if loopback => Ok(url),
        "http" => Err(CommandError::new("invalid_base_url", "Use https:// for remote servers (http:// is only allowed for localhost).")),
        _ => Err(CommandError::new("invalid_base_url", "Only http(s) URLs are supported.")),
    }
}

pub fn resolve_url(kind: ProviderKind, base_url: Option<&str>, path: &str) -> Result<Url, CommandError> {
    validate_path(path)?;
    let base = match kind.fixed_base() {
        Some(fixed) => fixed.to_string(),
        None => {
            let raw = base_url.ok_or_else(|| CommandError::new("invalid_base_url", "No server URL is configured."))?;
            validate_custom_base(raw)?.to_string()
        }
    };
    let joined = format!("{}{}", base.trim_end_matches('/'), path);
    Url::parse(&joined).map_err(|_| CommandError::new("invalid_base_url", "Could not build the request URL."))
}

/// Removes every occurrence of the key from a string (defence in depth: providers should never echo it).
pub fn redact(text: &str, key: Option<&str>) -> String {
    match key {
        Some(k) if k.len() >= 6 => text.replace(k, "[REDACTED]"),
        _ => text.to_string(),
    }
}

fn parse_retry_after(headers: &reqwest::header::HeaderMap) -> Option<f64> {
    headers
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.trim().parse::<f64>().ok())
        .filter(|v| v.is_finite() && *v >= 0.0)
}

pub async fn send(req: ProviderHttpRequest, key: Option<String>) -> Result<ProviderHttpResponse, CommandError> {
    let kind = ProviderKind::parse(&req.provider)?;
    let url = resolve_url(kind, req.base_url.as_deref(), &req.path)?;
    if kind.key_required() && key.is_none() {
        return Err(CommandError::new("missing_key", "No API key is saved for this provider. Add one in Settings."));
    }
    let timeout = req.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS).clamp(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(timeout))
        .user_agent(concat!("SmartTextAI/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| CommandError::new("network", "Could not initialise the HTTP client."))?;

    let method = req.method.as_deref().unwrap_or("POST");
    let mut builder = match method {
        "GET" => client.get(url),
        "POST" => client.post(url).json(&req.body.unwrap_or(serde_json::Value::Null)),
        _ => return Err(CommandError::new("invalid_method", "Only GET and POST are allowed.")),
    };
    match kind {
        ProviderKind::Anthropic => {
            builder = builder.header("anthropic-version", "2023-06-01");
            if let Some(k) = key.as_deref() {
                builder = builder.header("x-api-key", k);
            }
        }
        ProviderKind::OpenAi | ProviderKind::OpenAiCompatible => {
            if let Some(k) = key.as_deref() {
                builder = builder.bearer_auth(k);
            }
        }
    }

    let resp = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            CommandError::new("timeout", format!("The provider did not respond within {} seconds.", timeout / 1000))
        } else if e.is_connect() {
            CommandError::new("network", "Could not connect to the provider. Check your internet connection or server URL.")
        } else {
            CommandError::new("network", "The request to the provider failed.")
        }
    })?;
    let status = resp.status().as_u16();
    let retry_after = parse_retry_after(resp.headers());
    let body = resp
        .text()
        .await
        .map_err(|_| CommandError::new("network", "The provider's response could not be read."))?;
    Ok(ProviderHttpResponse { status, body: redact(&body, key.as_deref()), retry_after })
}

#[tauri::command]
pub async fn provider_request(request: ProviderHttpRequest) -> Result<ProviderHttpResponse, CommandError> {
    let kind = ProviderKind::parse(&request.provider)?;
    let key = match secrets::read_key(kind) {
        Ok(key) => key,
        // Local OpenAI-compatible servers usually need no key, so an unusable credential store
        // must not block them. A server that does need a key answers 401, which the UI explains.
        Err(err) if kind == ProviderKind::OpenAiCompatible && err.code == "keychain_unavailable" => {
            eprintln!("smarttext: credential store unavailable; sending the request without an API key");
            None
        }
        Err(err) => return Err(err),
    };
    send(request, key).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixed_providers_ignore_custom_base_urls() {
        let u = resolve_url(ProviderKind::OpenAi, Some("https://evil.example"), "/chat/completions").unwrap();
        assert_eq!(u.as_str(), "https://api.openai.com/v1/chat/completions");
        let u = resolve_url(ProviderKind::Anthropic, None, "/messages").unwrap();
        assert_eq!(u.as_str(), "https://api.anthropic.com/v1/messages");
    }

    #[test]
    fn rejects_path_traversal_and_odd_paths() {
        for p in ["../x", "/a/../b", "chat", "/a?b=1", "//host/x", "/a b"] {
            assert!(resolve_url(ProviderKind::OpenAi, None, p).is_err(), "{p} should be rejected");
        }
    }

    #[test]
    fn custom_base_rules() {
        assert!(validate_custom_base("http://localhost:11434/v1").is_ok());
        assert!(validate_custom_base("http://127.0.0.1:1234/v1").is_ok());
        assert!(validate_custom_base("https://openrouter.ai/api/v1").is_ok());
        assert!(validate_custom_base("http://192.168.1.4:8000/v1").is_err());
        assert!(validate_custom_base("https://user:pw@host/v1").is_err());
        assert!(validate_custom_base("ftp://host/v1").is_err());
        assert!(validate_custom_base("not a url").is_err());
        let u = resolve_url(ProviderKind::OpenAiCompatible, Some("http://localhost:11434/v1/"), "/chat/completions").unwrap();
        assert_eq!(u.as_str(), "http://localhost:11434/v1/chat/completions");
        assert!(resolve_url(ProviderKind::OpenAiCompatible, None, "/models").is_err());
    }

    #[test]
    fn redacts_keys() {
        assert_eq!(redact("bad key sk-123456789 used", Some("sk-123456789")), "bad key [REDACTED] used");
        assert_eq!(redact("abc", None), "abc");
    }

    #[test]
    fn unknown_provider_is_rejected() {
        assert_eq!(ProviderKind::parse("gemini").unwrap_err().code, "unknown_provider");
    }

    #[tokio::test]
    async fn missing_key_fails_before_network() {
        let req = ProviderHttpRequest {
            provider: "openai".into(),
            base_url: None,
            path: "/models".into(),
            method: Some("GET".into()),
            body: None,
            timeout_ms: Some(2000),
        };
        assert_eq!(send(req, None).await.unwrap_err().code, "missing_key");
    }
}
