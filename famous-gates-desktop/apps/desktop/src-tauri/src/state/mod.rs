// Shared Rust application state — held in Tauri's managed state

use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default)]
pub struct AppState {
    pub session: Mutex<Option<SessionState>>,
    pub network: Mutex<NetworkState>,
    pub sync: Mutex<SyncState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub user_id: String,
    pub email: String,
    pub role: String,
    pub branch_id: Option<i64>,
    pub branch_name: Option<String>,
    pub token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkState {
    pub is_online: bool,
    pub last_checked: i64,
    pub node_api_reachable: bool,
    pub python_api_reachable: bool,
    pub supabase_reachable: bool,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            is_online: false,
            last_checked: 0,
            node_api_reachable: false,
            python_api_reachable: false,
            supabase_reachable: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SyncState {
    pub outbox_count: usize,
    pub last_sync_at: Option<i64>,
    pub is_syncing: bool,
    pub last_error: Option<String>,
}
