-- Outbox table — pending mutations waiting to sync to remote APIs

CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,           -- e.g. bookings, orders, payments
    operation TEXT NOT NULL,        -- CREATE | UPDATE | DELETE
    endpoint TEXT NOT NULL,         -- e.g. /bookings or /bookings/uuid
    method TEXT NOT NULL,           -- POST | PUT | PATCH | DELETE
    payload TEXT NOT NULL,          -- JSON body
    status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | RETRYING | FAILED | SYNCED
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    synced_at INTEGER
);

-- Conflict log — records when local and remote diverge
CREATE TABLE IF NOT EXISTS conflict_log (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    outbox_id TEXT,
    local_payload TEXT NOT NULL,
    remote_payload TEXT NOT NULL,
    detected_at INTEGER NOT NULL DEFAULT (unixepoch()),
    resolved INTEGER NOT NULL DEFAULT 0,
    resolution TEXT  -- LOCAL_WINS | REMOTE_WINS | MERGED
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(entity);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);
