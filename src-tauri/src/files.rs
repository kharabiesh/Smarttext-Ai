//! Saving exports (text, images) to a location the user picks in a native dialog.
//! The dialog runs on the Rust side, so the webview cannot write to arbitrary paths.

use base64::Engine;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::error::CommandError;

const MAX_BYTES: usize = 50 * 1024 * 1024;

#[tauri::command]
pub async fn save_file(
    app: AppHandle,
    default_name: String,
    content_base64: String,
    filter_name: String,
    extensions: Vec<String>,
) -> Result<Option<String>, CommandError> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(content_base64.as_bytes())
        .map_err(|_| CommandError::new("invalid_content", "The file content could not be decoded."))?;
    if bytes.len() > MAX_BYTES {
        return Err(CommandError::new("invalid_content", "The file is too large to save."));
    }
    let exts: Vec<&str> = extensions.iter().map(String::as_str).collect();
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(&filter_name, &exts)
        .blocking_save_file();
    let Some(path) = picked else { return Ok(None) };
    let path = path
        .into_path()
        .map_err(|_| CommandError::new("io", "The selected location is not a local file path."))?;
    std::fs::write(&path, bytes).map_err(|e| CommandError::new("io", format!("Could not write the file: {e}")))?;
    Ok(Some(path.display().to_string()))
}
