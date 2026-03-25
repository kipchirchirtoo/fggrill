use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub synced: usize,
    pub failed: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictRecord {
    pub id: String,
    pub entity: String,
    pub local_payload: String,
    pub remote_payload: String,
    pub detected_at: i64,
    pub resolved: bool,
    pub resolution: Option<String>, // "LOCAL_WINS" | "REMOTE_WINS" | "MERGED"
}
