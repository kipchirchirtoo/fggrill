-- Fix orphaned expense by assigning it to Branch 2
-- This migration assigns branch_id to expenses that have NULL branch_id

UPDATE expenses 
SET branch_id = 2 
WHERE branch_id IS NULL 
  AND expense_date = '2026-01-04'
  AND category = 'Utilities';

-- Verify the fix
SELECT id, branch_id, amount, category, expense_date 
FROM expenses 
WHERE expense_date = '2026-01-04';
