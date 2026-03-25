// App-level commands — window management, branch config

use tauri::{AppHandle, Manager};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchConfig {
    pub branch_id: i64,
    pub branch_name: String,
    pub is_central: bool,
    pub node_api_url: String,
    pub python_api_url: String,
}

#[tauri::command]
pub async fn cmd_get_app_info(app: AppHandle) -> Result<AppInfo, String> {
    Ok(AppInfo {
        name: app.package_info().name.clone(),
        version: app.package_info().version.to_string(),
        tauri_version: tauri::VERSION.to_string(),
    })
}

/// Open the POS terminal window
#[tauri::command]
pub async fn cmd_open_pos_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("pos") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    } else {
        tauri::WebviewWindowBuilder::new(&app, "pos", tauri::WebviewUrl::App("/terminal".into()))
            .title("FG POS Terminal")
            .inner_size(1024.0, 768.0)
            .build()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Return branch configuration from local store
#[tauri::command]
pub async fn cmd_get_branch_config() -> Result<BranchConfig, String> {
    // TODO: read from tauri-plugin-store
    Ok(BranchConfig {
        branch_id: 1,
        branch_name: "Famous Gates".to_string(),
        is_central: true,
        node_api_url: "https://api.hirall.com".to_string(),
        python_api_url: "https://services.hirall.com".to_string(),
    })
}
