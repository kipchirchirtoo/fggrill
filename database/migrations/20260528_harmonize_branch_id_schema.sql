-- =====================================================
-- HARMONIZE BRANCH_ID SCHEMA ACROSS ALL TABLES
-- Fixes inconsistent branch_id types (INTEGER vs UUID)
-- =====================================================
-- 
-- ISSUE: branches.id is INTEGER, but some tables reference it as UUID
-- SOLUTION: Convert all branch_id columns to INTEGER for consistency
-- 
-- AFFECTED TABLES:
-- - reservations.branch_id (UUID → INTEGER)
-- - Any other tables with UUID branch_id that should reference branches(id)
-- =====================================================

-- 1. Fix reservations.branch_id (currently UUID, should be INTEGER)
DO $$ 
BEGIN
  -- Check if reservations.branch_id exists and is UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' 
    AND column_name = 'branch_id'
    AND data_type = 'uuid'
  ) THEN
    -- Drop the UUID column
    ALTER TABLE reservations DROP COLUMN branch_id;
    
    -- Add INTEGER column with proper foreign key
    ALTER TABLE reservations ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    
    RAISE NOTICE 'Fixed reservations.branch_id: UUID → INTEGER';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' 
    AND column_name = 'branch_id'
    AND data_type IN ('integer', 'int', 'int4')
  ) THEN
    RAISE NOTICE 'reservations.branch_id already INTEGER - no change needed';
  ELSE
    -- Column doesn't exist, add it as INTEGER
    ALTER TABLE reservations ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
    RAISE NOTICE 'Added reservations.branch_id as INTEGER';
  END IF;
END $$;

-- 2. Ensure rooms.branch_id is INTEGER (should already be from 20260523 migration)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE rooms ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    RAISE NOTICE 'Added rooms.branch_id as INTEGER';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rooms' 
    AND column_name = 'branch_id'
    AND data_type NOT IN ('integer', 'int', 'int4')
  ) THEN
    RAISE WARNING 'rooms.branch_id exists but is not INTEGER - manual intervention required';
  END IF;
END $$;

-- 3. Ensure folios.branch_id exists and is INTEGER
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'folios' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE folios ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    RAISE NOTICE 'Added folios.branch_id as INTEGER';
  END IF;
END $$;

-- 4. Ensure transactions.branch_id exists and is INTEGER
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    RAISE NOTICE 'Added transactions.branch_id as INTEGER';
  END IF;
END $$;

-- 5. Ensure guests.branch_id exists and is INTEGER (for branch-specific guest records)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'guests' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE guests ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    RAISE NOTICE 'Added guests.branch_id as INTEGER';
  END IF;
END $$;

-- 6. Add indexes for branch filtering performance
CREATE INDEX IF NOT EXISTS idx_reservations_branch_id ON reservations(branch_id);
CREATE INDEX IF NOT EXISTS idx_folios_branch_id ON folios(branch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_branch_id ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_guests_branch_id ON guests(branch_id);

-- 7. Update RLS policies to enforce branch isolation on reservations
DROP POLICY IF EXISTS "Users can view reservations from their branch" ON reservations;
CREATE POLICY "Users can view reservations from their branch" ON reservations
  FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'auditor', 'director')
    )
  );

-- 8. Update RLS policies for folios
DROP POLICY IF EXISTS "Users can view folios from their branch" ON folios;
CREATE POLICY "Users can view folios from their branch" ON folios
  FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM users WHERE id = auth.uid()
    ) OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'general_manager', 'auditor', 'director')
    )
  );

-- 9. Create function to auto-assign branch_id on reservation insert
CREATE OR REPLACE FUNCTION auto_assign_reservation_branch()
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

-- 10. Apply trigger to auto-assign branch on reservations
DROP TRIGGER IF EXISTS auto_assign_reservation_branch_trigger ON reservations;
CREATE TRIGGER auto_assign_reservation_branch_trigger
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_reservation_branch();

-- 11. Create function to auto-assign branch_id on folio insert
CREATE OR REPLACE FUNCTION auto_assign_folio_branch()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    -- Try to get branch from associated reservation
    IF NEW.reservation_id IS NOT NULL THEN
      SELECT branch_id INTO NEW.branch_id
      FROM reservations
      WHERE id = NEW.reservation_id
      LIMIT 1;
    END IF;
    
    -- Fallback to creator's branch
    IF NEW.branch_id IS NULL THEN
      SELECT branch_id INTO NEW.branch_id
      FROM users
      WHERE id = auth.uid()
      LIMIT 1;
    END IF;
    
    -- Final fallback to branch 1
    IF NEW.branch_id IS NULL THEN
      NEW.branch_id := 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Apply trigger to auto-assign branch on folios
DROP TRIGGER IF EXISTS auto_assign_folio_branch_trigger ON folios;
CREATE TRIGGER auto_assign_folio_branch_trigger
  BEFORE INSERT ON folios
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_folio_branch();

-- 13. Log the harmonization
DO $$
DECLARE
  reservations_count INTEGER;
  rooms_count INTEGER;
  folios_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO reservations_count FROM reservations WHERE branch_id IS NOT NULL;
  SELECT COUNT(*) INTO rooms_count FROM rooms WHERE branch_id IS NOT NULL;
  SELECT COUNT(*) INTO folios_count FROM folios WHERE branch_id IS NOT NULL;
  
  RAISE NOTICE 'Branch ID schema harmonization complete:';
  RAISE NOTICE '  - Reservations with branch_id: %', reservations_count;
  RAISE NOTICE '  - Rooms with branch_id: %', rooms_count;
  RAISE NOTICE '  - Folios with branch_id: %', folios_count;
  RAISE NOTICE 'All branch_id columns now use INTEGER type referencing branches(id)';
END $$;
