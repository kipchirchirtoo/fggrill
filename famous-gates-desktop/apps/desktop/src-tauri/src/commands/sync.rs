// Sync commands — manual trigger, outbox inspection

use tauri::{AppHandle, State};
use crate::state::AppState;
use crate::services::sync as sync_service;
use crate::models::sync::SyncResult;

/// Force an immediate sync cycle
#[tauri::command]
pub async fn cmd_force_sync(app: AppHandle) -> Result<SyncResult, String> {
    sync_service::run_sync_cycle(&app)
        .await
        .map_err(|e| e.to_string())
}

/// Return the number of pending outbox entries
#[tauri::command]
pub async fn cmd_get_outbox_count(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let sync = state.sync.lock().unwrap();
    Ok(sync.outbox_count)
}

/// Clear all FAILED outbox entries (admin action)
#[tauri::command]
pub async fn cmd_clear_outbox() -> Result<(), String> {
    // TODO: DELETE FROM outbox WHERE status = 'FAILED'
    log::info!("[Sync] Outbox cleared by user");
    Ok(())
}
