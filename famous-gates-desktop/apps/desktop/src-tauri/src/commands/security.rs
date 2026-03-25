// Security commands — OS keychain access from frontend

use crate::services::security;

#[tauri::command]
pub async fn cmd_store_token(key: String, value: String) -> Result<(), String> {
    security::store_token(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_token(key: String) -> Result<Option<String>, String> {
    security::get_token(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_delete_token(key: String) -> Result<(), String> {
    security::delete_token(&key).map_err(|e| e.to_string())
}
