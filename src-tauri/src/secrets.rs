//! API keys live in the operating system's credential store
//! (macOS Keychain, Windows Credential Manager, Secret Service on Linux).
//! Keys are written and read only on the Rust side: no command ever returns a key to the webview.

use std::collections::HashMap;

use crate::error::CommandError;
use crate::provider::ProviderKind;

pub const SERVICE: &str = "com.ismaielalmarie.smarttextai";

/// Basic sanity checks for a pasted key. Providers do their own validation;
/// this only rejects values that can never be valid header values.
pub fn validate_key(key: &str) -> Result<&str, CommandError> {
    let key = key.trim();
    if key.is_empty() {
        return Err(CommandError::new("invalid_key", "The API key is empty."));
    }
    if key.len() > 1024 {
        return Err(CommandError::new("invalid_key", "The API key is too long."));
    }
    if key.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return Err(CommandError::new("invalid_key", "The API key contains spaces or control characters."));
    }
    Ok(key)
}

fn entry(kind: ProviderKind) -> Result<keyring::Entry, CommandError> {
    keyring::Entry::new(SERVICE, kind.id()).map_err(keychain_error)
}

fn keychain_error(err: keyring::Error) -> CommandError {
    // keyring errors never include the secret itself, but keep the message generic anyway.
    CommandError::new("keychain_unavailable", format!("The system credential store is unavailable ({}).", short_kind(&err)))
}

fn short_kind(err: &keyring::Error) -> &'static str {
    match err {
        keyring::Error::PlatformFailure(_) => "platform failure",
        keyring::Error::NoStorageAccess(_) => "no storage access",
        keyring::Error::NoEntry => "no entry",
        keyring::Error::BadEncoding(_) => "bad encoding",
        keyring::Error::TooLong(_, _) => "value too long",
        keyring::Error::Invalid(_, _) => "invalid attribute",
        keyring::Error::Ambiguous(_) => "ambiguous entry",
        _ => "unknown error",
    }
}

pub fn read_key(kind: ProviderKind) -> Result<Option<String>, CommandError> {
    match entry(kind)?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keychain_error(e)),
    }
}

#[tauri::command]
pub fn secret_set(provider: String, key: String) -> Result<(), CommandError> {
    let kind = ProviderKind::parse(&provider)?;
    let key = validate_key(&key)?;
    entry(kind)?.set_password(key).map_err(keychain_error)
}

#[tauri::command]
pub fn secret_delete(provider: String) -> Result<(), CommandError> {
    let kind = ProviderKind::parse(&provider)?;
    match entry(kind)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keychain_error(e)),
    }
}

/// Reports which providers have a stored key (true/false only).
#[tauri::command]
pub fn secret_status() -> Result<HashMap<String, bool>, CommandError> {
    let mut out = HashMap::new();
    for kind in ProviderKind::ALL {
        let present = matches!(read_key(kind), Ok(Some(_)));
        out.insert(kind.id().to_string(), present);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_and_whitespace_keys() {
        assert!(validate_key("   ").is_err());
        assert!(validate_key("sk-abc def").is_err());
        assert!(validate_key("sk-abc\n").is_ok()); // trailing newline is trimmed
        assert_eq!(validate_key("  sk-abc  ").unwrap(), "sk-abc");
    }

    #[test]
    fn rejects_overlong_keys() {
        let long = "a".repeat(2000);
        assert_eq!(validate_key(&long).unwrap_err().code, "invalid_key");
    }
}
