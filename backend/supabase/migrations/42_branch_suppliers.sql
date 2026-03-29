-- Migration: Add branch_id to suppliers for branch-specific isolation
-- Created: March 28, 2026

-- Add branch_id column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE;

-- Create index for performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_suppliers_branch_id ON suppliers(branch_id);

-- Update permissions to ensure authenticated users can interact with the modified table
GRANT ALL ON suppliers TO authenticated;

-- Comment for documentation
COMMENT ON COLUMN suppliers.branch_id IS 'Associated branch for branch-specific suppliers (NULL for global/central suppliers)';
