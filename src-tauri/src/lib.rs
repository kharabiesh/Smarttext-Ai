mod error;
mod files;
mod provider;
mod secrets;

use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    data_dir: String,
    platform: String,
    arch: String,
}

/// Version and the folder that holds the local SQLite database (shown in Settings → Privacy).
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    let data_dir = app
        .path()
        .app_config_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_default();
    AppInfo {
        version: app.package_info().version.to_string(),
        data_dir,
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_info,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_status,
            provider::provider_request,
            files::save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SmartText AI");
}
