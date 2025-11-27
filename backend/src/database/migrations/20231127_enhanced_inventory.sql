-- Enhanced Inventory Schema
-- Extends the simple_items table and adds tracking history

-- 1. Enhance simple_items table
ALTER TABLE simple_items 
ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS item_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS category VARCHAR(100),
ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50),
ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier VARCHAR(255),
ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update existing items to have item_name from description if empty
UPDATE simple_items SET item_name = description WHERE item_name IS NULL;

-- 2. Create Stock History Table
CREATE TABLE IF NOT EXISTS stock_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_sku VARCHAR(100) REFERENCES simple_items(sku) ON DELETE CASCADE,
    change_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'ADJUSTMENT'
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason VARCHAR(255), -- 'PURCHASE', 'SALE', 'DAMAGE', 'EXPIRED', 'USAGE', 'TRANSFER'
    reference VARCHAR(100), -- Invoice # or Order #
    notes TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster history lookups
CREATE INDEX IF NOT EXISTS idx_stock_history_sku ON stock_history(item_sku);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at);
CREATE INDEX IF NOT EXISTS idx_simple_items_barcode ON simple_items(barcode);
