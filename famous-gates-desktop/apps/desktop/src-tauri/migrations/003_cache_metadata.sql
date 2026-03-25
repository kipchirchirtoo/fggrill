-- Cache metadata — tracks freshness of each cached entity

CREATE TABLE IF NOT EXISTS cache_metadata (
    key TEXT PRIMARY KEY,           -- e.g. "bookings:branch:1" or "menu:items"
    entity TEXT NOT NULL,
    fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER,             -- NULL = never expires
    etag TEXT,                      -- HTTP ETag for conditional requests
    value TEXT                      -- small scalar cache values
);

-- Session store — persists last known session across restarts
CREATE TABLE IF NOT EXISTS local_session (
    id INTEGER PRIMARY KEY DEFAULT 1,
    user_id TEXT,
    email TEXT,
    role TEXT,
    branch_id INTEGER,
    branch_name TEXT,
    token_hash TEXT,                -- SHA-256 of token (not the token itself)
    expires_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cache_entity ON cache_metadata(entity);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_metadata(expires_at);
