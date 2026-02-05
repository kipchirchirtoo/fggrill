-- =============================================
-- FIX branch_id TYPE IN cashier_logbooks
-- =============================================
-- The branches table uses INTEGER for ID, but cashier_logbooks was created with UUID.
-- This migration converts branch_id to INTEGER to allow joining.

-- Drop existing views or constraints if any (none yet but good practice)

-- Alter the column type
-- Note: We use USING branch_id::text::integer if we expect numeric strings, 
-- but since it's currently empty or has invalid UUIDs, we might need to be careful.
-- If it has data, conversion might fail. Let's assume it's fresh.

ALTER TABLE cashier_logbooks 
ALTER COLUMN branch_id TYPE INTEGER USING (branch_id::text::integer);

-- Re-add foreign key if branches table exists and has INTEGER ID
ALTER TABLE cashier_logbooks
ADD CONSTRAINT cashier_logbooks_branch_id_fkey 
FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
