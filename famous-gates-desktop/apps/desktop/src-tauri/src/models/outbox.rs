use serde::{Deserialize, Serialize};

/// A pending mutation waiting to be synced to the remote API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEntry {
    pub id: String,
    pub entity: String,          // e.g. "bookings", "orders", "payments"
    pub operation: String,       // "CREATE" | "UPDATE" | "DELETE"
    pub payload: String,         // JSON-serialized body
    pub endpoint: String,        // e.g. "/bookings" or "/bookings/:id"
    pub method: String,          // "POST" | "PUT" | "PATCH" | "DELETE"
    pub created_at: i64,
    pub retry_count: i32,
    pub last_error: Option<String>,
    pub status: OutboxStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OutboxStatus {
    Pending,
    Retrying,
    Failed,
    Synced,
}

impl std::fmt::Display for OutboxStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OutboxStatus::Pending => write!(f, "PENDING"),
            OutboxStatus::Retrying => write!(f, "RETRYING"),
            OutboxStatus::Failed => write!(f, "FAILED"),
            OutboxStatus::Synced => write!(f, "SYNCED"),
        }
    }
}
