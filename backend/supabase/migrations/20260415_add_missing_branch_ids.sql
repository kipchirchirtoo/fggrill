-- Add branch_id to tables that are missing it

ALTER TABLE simple_items ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE staff_payroll_adjustments ADD COLUMN IF NOT EXISTS branch_id INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_simple_items_branch_id ON simple_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_branch_id ON stock_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_id ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_store_items_branch_id ON store_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_adjustments_branch_id ON staff_payroll_adjustments(branch_id);
