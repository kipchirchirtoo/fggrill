-- Core local cache tables
-- These mirror the remote Supabase schema for offline reads

CREATE TABLE IF NOT EXISTS local_bookings (
    id TEXT PRIMARY KEY,
    confirmation_number TEXT UNIQUE,
    guest_name TEXT,
    room_id TEXT,
    check_in TEXT,
    check_out TEXT,
    status TEXT,
    branch_id INTEGER,
    total_amount REAL,
    payload TEXT NOT NULL,  -- full JSON blob
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_rooms (
    id TEXT PRIMARY KEY,
    room_number TEXT,
    room_type TEXT,
    status TEXT,
    branch_id INTEGER,
    payload TEXT NOT NULL,
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_staff (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    role TEXT,
    branch_id INTEGER,
    payload TEXT NOT NULL,
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_menu_items (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    price REAL,
    available INTEGER DEFAULT 1,
    branch_id INTEGER,
    payload TEXT NOT NULL,
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    status TEXT,
    total_amount REAL,
    branch_id INTEGER,
    payload TEXT NOT NULL,
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS local_inventory (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE,
    name TEXT,
    quantity REAL,
    unit TEXT,
    branch_id INTEGER,
    payload TEXT NOT NULL,
    synced_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_bookings_branch ON local_bookings(branch_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON local_bookings(status);
CREATE INDEX IF NOT EXISTS idx_orders_branch ON local_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON local_inventory(sku);
