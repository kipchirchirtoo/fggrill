// Network commands — online/offline detection

use tauri::State;
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::services::http::ApiClient;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub is_online: bool,
    pub node_api: bool,
    pub python_api: bool,
    pub checked_at: i64,
}

/// Check connectivity to all backend services
#[tauri::command]
pub async fn cmd_get_network_status(
    state: State<'_, AppState>,
) -> Result<NetworkStatus, String> {
    let node = ApiClient::ping_node().await;
    let python = ApiClient::ping_python().await;
    let is_online = node || python;

    let now = chrono::Utc::now().timestamp();

    // Update shared state
    {
        let mut net = state.network.lock().unwrap();
        net.is_online = is_online;
        net.node_api_reachable = node;
        net.python_api_reachable = python;
        net.last_checked = now;
    }

    Ok(NetworkStatus {
        is_online,
        node_api: node,
        python_api: python,
        checked_at: now,
    })
}

/// Quick ping — returns true/false
#[tauri::command]
pub async fn cmd_ping_api() -> Result<bool, String> {
    Ok(ApiClient::ping_node().await)
}
