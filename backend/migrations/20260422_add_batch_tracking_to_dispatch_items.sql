-- Add batch tracking fields to dispatch_items table
-- This adds support for batch numbers, expiry dates, and bin locations

ALTER TABLE dispatch_items 
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS bin_location VARCHAR(50);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_dispatch_items_batch ON dispatch_items(batch_number);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_expiry ON dispatch_items(expiry_date);

-- Add missing quantity tracking columns if they don't exist
ALTER TABLE dispatch_items
  ADD COLUMN IF NOT EXISTS damaged_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discrepancy_reason TEXT;

COMMENT ON COLUMN dispatch_items.batch_number IS 'Batch/lot number for tracking';
COMMENT ON COLUMN dispatch_items.expiry_date IS 'Expiry date for perishable items';
COMMENT ON COLUMN dispatch_items.bin_location IS 'Warehouse bin location where item was picked from';
