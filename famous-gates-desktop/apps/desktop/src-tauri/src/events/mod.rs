// Event definitions — emitted from Rust to the frontend

/// Emitted when a sync cycle completes
pub const SYNC_COMPLETE: &str = "sync:complete";

/// Emitted when a sync cycle encounters an error
pub const SYNC_ERROR: &str = "sync:error";

/// Emitted when sync progress updates
pub const SYNC_PROGRESS: &str = "sync:progress";

/// Emitted when network status changes
pub const NETWORK_CHANGE: &str = "network:change";

/// Emitted when a conflict is detected
pub const CONFLICT_DETECTED: &str = "sync:conflict";

/// Emitted when the auth token is about to expire
pub const TOKEN_EXPIRING: &str = "auth:token-expiring";

/// Emitted when the session is invalidated
pub const SESSION_EXPIRED: &str = "auth:session-expired";
