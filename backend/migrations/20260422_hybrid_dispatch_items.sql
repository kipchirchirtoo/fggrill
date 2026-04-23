-- Make dispatch_items work for BOTH mobile app and web API
-- Mobile app uses: item_id, quantity
-- Web API uses: item_sku, dispatched_quantity, received_quantity

-- Add web API columns alongside mobile columns
ALTER TABLE dispatch_items 
  ADD COLUMN IF NOT EXISTS item_sku VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dispatched_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS received_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';

-- Make item_id nullable since web API won't use it
ALTER TABLE dispatch_items ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE dispatch_items ALTER COLUMN item_name DROP NOT NULL;
ALTER TABLE dispatch_items ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE dispatch_items ALTER COLUMN unit DROP NOT NULL;

-- Create indexes for web API queries
CREATE INDEX IF NOT EXISTS idx_dispatch_items_sku ON dispatch_items(item_sku);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_status ON dispatch_items(status);

-- Add check constraint: must have either (item_id + quantity) OR (item_sku + dispatched_quantity)
ALTER TABLE dispatch_items DROP CONSTRAINT IF EXISTS dispatch_items_data_check;
ALTER TABLE dispatch_items ADD CONSTRAINT dispatch_items_data_check 
  CHECK (
    (item_id IS NOT NULL AND quantity IS NOT NULL) OR 
    (item_sku IS NOT NULL AND dispatched_quantity IS NOT NULL)
  );

-- Create a view for web API that uses the correct column names
CREATE OR REPLACE VIEW dispatch_items_web AS
SELECT 
  id,
  dispatch_id,
  COALESCE(item_sku, (SELECT item_code FROM inventory_items WHERE id = item_id)) as item_sku,
  COALESCE(dispatched_quantity, quantity) as dispatched_quantity,
  received_quantity,
  damaged_quantity,
  missing_quantity,
  batch_number,
  expiry_date,
  bin_location,
  status,
  discrepancy_reason,
  created_at,
  updated_at
FROM dispatch_items;

-- Create a view for mobile app that uses the correct column names  
CREATE OR REPLACE VIEW dispatch_items_mobile AS
SELECT 
  id,
  dispatch_id,
  item_id,
  item_name,
  COALESCE(quantity, dispatched_quantity) as quantity,
  unit,
  notes,
  created_at,
  updated_at
FROM dispatch_items;

COMMENT ON TABLE dispatch_items IS 'Hybrid table supporting both mobile app (item_id) and web API (item_sku)';
COMMENT ON COLUMN dispatch_items.item_id IS 'Used by mobile app - references inventory_items(id)';
COMMENT ON COLUMN dispatch_items.item_sku IS 'Used by web API - references simple_items(sku)';
COMMENT ON COLUMN dispatch_items.quantity IS 'Used by mobile app';
COMMENT ON COLUMN dispatch_items.dispatched_quantity IS 'Used by web API';
