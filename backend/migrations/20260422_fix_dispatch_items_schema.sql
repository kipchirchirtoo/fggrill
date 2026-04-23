-- Fix dispatch_items table schema to match API expectations
-- The table currently has item_id/item_name/quantity but the API expects item_sku/dispatched_quantity/received_quantity

-- First, backup any existing data (if any)
CREATE TABLE IF NOT EXISTS dispatch_items_backup AS SELECT * FROM dispatch_items;

-- Drop the old table
DROP TABLE IF EXISTS dispatch_items CASCADE;

-- Recreate with correct schema matching the API code
CREATE TABLE dispatch_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
    item_sku VARCHAR(50) NOT NULL,
    
    -- Quantities
    dispatched_quantity INTEGER NOT NULL,
    received_quantity INTEGER,
    damaged_quantity INTEGER DEFAULT 0,
    missing_quantity INTEGER DEFAULT 0,
    
    -- Tracking
    batch_number VARCHAR(50),
    expiry_date DATE,
    bin_location VARCHAR(50),
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    discrepancy_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX idx_dispatch_items_sku ON dispatch_items(item_sku);
CREATE INDEX idx_dispatch_items_batch ON dispatch_items(batch_number);
CREATE INDEX idx_dispatch_items_expiry ON dispatch_items(expiry_date);

-- Add comments
COMMENT ON TABLE dispatch_items IS 'Items included in dispatch notes for inter-branch transfers';
COMMENT ON COLUMN dispatch_items.item_sku IS 'SKU from simple_items table';
COMMENT ON COLUMN dispatch_items.dispatched_quantity IS 'Quantity sent from source branch';
COMMENT ON COLUMN dispatch_items.received_quantity IS 'Quantity confirmed received by destination branch';
COMMENT ON COLUMN dispatch_items.batch_number IS 'Batch/lot number for tracking';
COMMENT ON COLUMN dispatch_items.expiry_date IS 'Expiry date for perishable items';
COMMENT ON COLUMN dispatch_items.bin_location IS 'Warehouse bin location where item was picked from';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON dispatch_items TO authenticated;

-- Enable RLS
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "dispatch_items_policy" ON dispatch_items;
CREATE POLICY "dispatch_items_policy" ON dispatch_items
  FOR ALL TO authenticated 
  USING (true) 
  WITH CHECK (true);
