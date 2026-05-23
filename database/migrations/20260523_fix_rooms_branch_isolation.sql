-- =====================================================
-- FIX ROOMS BRANCH ISOLATION
-- Ensures rooms are properly assigned to branches
-- =====================================================

-- 1. Ensure branch_id column exists on rooms table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE rooms ADD COLUMN branch_id INTEGER REFERENCES branches(id);
  END IF;
END $$;

-- 2. Ensure all rooms have a valid branch_id (assign to branch 1 if NULL)
UPDATE rooms 
SET branch_id = 1 
WHERE branch_id IS NULL;

-- 3. Add NOT NULL constraint to prevent future issues
-- First check if all rooms have branch_id
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM rooms WHERE branch_id IS NULL;
  
  IF null_count = 0 THEN
    -- Safe to add NOT NULL constraint
    ALTER TABLE rooms ALTER COLUMN branch_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Cannot add NOT NULL constraint: % rooms still have NULL branch_id', null_count;
  END IF;
END $$;

-- 4. Add index for faster branch filtering
CREATE INDEX IF NOT EXISTS idx_rooms_branch_id ON rooms(branch_id);

-- 5. Update RLS policy to enforce branch isolation
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;

-- Create new policy that allows viewing only rooms from user's branch
CREATE POLICY "Users can view rooms from their branch" ON rooms
  FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'auditor')
    )
  );

-- 6. Function to auto-assign branch_id on insert if not provided
CREATE OR REPLACE FUNCTION auto_assign_room_branch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    -- Get the creator's branch_id
    SELECT branch_id INTO NEW.branch_id
    FROM users
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- Fallback to branch 1 if still null
    IF NEW.branch_id IS NULL THEN
      NEW.branch_id := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Apply trigger to auto-assign branch
DROP TRIGGER IF EXISTS auto_assign_room_branch_trigger ON rooms;
CREATE TRIGGER auto_assign_room_branch_trigger
  BEFORE INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_room_branch();

-- 8. Log the fix
DO $$
DECLARE
  total_rooms INTEGER;
  rooms_by_branch INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_rooms FROM rooms;
  SELECT COUNT(DISTINCT branch_id) INTO rooms_by_branch FROM rooms;
  
  RAISE NOTICE 'Rooms branch isolation fix applied: % total rooms across % branches', total_rooms, rooms_by_branch;
END $$;
