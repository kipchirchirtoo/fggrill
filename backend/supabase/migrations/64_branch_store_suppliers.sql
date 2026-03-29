-- Migration: Add branch_id to store_suppliers for branch-specific isolation
-- Created: March 28, 2026

-- 1. Add branch_id column to store_suppliers table
ALTER TABLE store_suppliers 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

-- 2. Create index for performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_store_suppliers_branch_id ON store_suppliers(branch_id);

-- 3. Update permissions
GRANT ALL ON store_suppliers TO authenticated;

-- 4. Comment for documentation
COMMENT ON COLUMN store_suppliers.branch_id IS 'Associated branch for branch-specific suppliers (NULL for global/central suppliers)';
