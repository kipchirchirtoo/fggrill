-- Migration to implement Simple Stock Management tables

-- Items Table
CREATE TABLE IF NOT EXISTS simple_items (
    sku VARCHAR(100) PRIMARY KEY,
    description VARCHAR(250) NOT NULL,
    retail_price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Shop Items Table (Items held by specific users/shops)
CREATE TABLE IF NOT EXISTS simple_shop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_sku VARCHAR(100) REFERENCES simple_items(sku) ON DELETE SET NULL,
    quantity INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_user_id, item_sku)
);

-- Transfer Items Table (Pending transfers)
CREATE TABLE IF NOT EXISTS simple_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_sku VARCHAR(100) REFERENCES simple_items(sku) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0,
    ordered BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- App Configuration Table
CREATE TABLE IF NOT EXISTS simple_app_config (
    id INTEGER PRIMARY KEY, -- Usually just 1
    edit_lock BOOLEAN DEFAULT FALSE,
    allow_uploads BOOLEAN DEFAULT FALSE,
    allow_upload_deletions BOOLEAN DEFAULT FALSE,
    allow_email_notifications BOOLEAN DEFAULT FALSE,
    records_per_page INTEGER DEFAULT 25
);

-- Insert default config
INSERT INTO simple_app_config (id, edit_lock, allow_uploads)
VALUES (1, false, false)
ON CONFLICT (id) DO NOTHING;
