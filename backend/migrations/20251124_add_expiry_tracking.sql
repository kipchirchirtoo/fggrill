-- Drop table with potentially incorrect schema
DROP TABLE IF EXISTS inventory_batches CASCADE;

-- Add expiry date tracking to inventory items
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS has_expiry BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expiry_alert_days INTEGER DEFAULT 30;

-- Create batch tracking table
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id INTEGER REFERENCES inventory_items(id) NOT NULL,
  branch VARCHAR(50) NOT NULL,
  batch_number VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  manufacturing_date DATE,
  expiry_date DATE,
  cost_price DECIMAL(10,2) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for expiry date queries
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batch_item ON inventory_batches(item_id);

-- Create view for expiring items
CREATE OR REPLACE VIEW v_expiring_items AS
SELECT 
  i.id as item_id,
  i.item_code,
  i.name,
  i.category,
  i.subcategory,
  ib.branch,
  ib.batch_number,
  ib.quantity,
  ib.expiry_date,
  ib.manufacturing_date,
  (ib.expiry_date - CURRENT_DATE) as days_until_expiry
FROM inventory_items i
JOIN inventory_batches ib ON i.id = ib.item_id
WHERE 
  i.has_expiry = true 
  AND ib.quantity > 0
  AND ib.expiry_date IS NOT NULL
  AND ib.expiry_date > CURRENT_DATE
  AND (ib.expiry_date - CURRENT_DATE) <= i.expiry_alert_days
ORDER BY ib.expiry_date ASC;

-- Function to check for expiring items
CREATE OR REPLACE FUNCTION check_expiring_items()
RETURNS TABLE (
  item_id INTEGER,
  item_name TEXT,
  branch TEXT,
  batch_number TEXT,
  quantity INTEGER,
  expiry_date DATE,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    ib.branch,
    ib.batch_number,
    ib.quantity,
    ib.expiry_date,
    (ib.expiry_date - CURRENT_DATE)::INTEGER as days_until_expiry
  FROM inventory_items i
  JOIN inventory_batches ib ON i.id = ib.item_id
  WHERE 
    i.has_expiry = true 
    AND ib.quantity > 0
    AND ib.expiry_date IS NOT NULL
    AND ib.expiry_date > CURRENT_DATE
    AND (ib.expiry_date - CURRENT_DATE) <= i.expiry_alert_days;
END;
$$ LANGUAGE plpgsql;
