-- =============================================================
-- 0020: Fix Housekeeping schema
--
-- Errors fixed:
-- 7. GET /api/housekeeping/tasks → PGRST200: no relationship hk_tasks→hk_staff_profiles via assigned_to
-- 8. GET /api/housekeeping/dashboard/room-grid → PGRST200: no relationship rooms→hk_staff_profiles via assigned_attendant_id
--
-- Root cause: hk_staff_profiles table doesn't exist.
-- Controllers join to it from hk_tasks.assigned_to and rooms.assigned_attendant_id.
-- =============================================================

-- ---------------------------------------------------------------
-- Create hk_staff_profiles table
-- Used by:
--   hk_tasks.assigned_to → hk_staff_profiles(id)
--   hk_tasks.completed_by → hk_staff_profiles(id)
--   rooms.assigned_attendant_id → hk_staff_profiles(id)
-- Controller selects: id, staff_code, designation, user:users!user_id(...)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hk_staff_profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_code  TEXT,
  designation TEXT DEFAULT 'room_attendant',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_hk_staff_profiles_branch ON hk_staff_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_hk_staff_profiles_user   ON hk_staff_profiles(user_id);

-- ---------------------------------------------------------------
-- Fix hk_tasks: reassign assigned_to FK from users → hk_staff_profiles
-- Also add missing columns used by tasks.controller.ts
-- ---------------------------------------------------------------

-- Add missing columns first
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS task_number             TEXT;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS due_by                  TIMESTAMPTZ;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS started_at              TIMESTAMPTZ;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS floor_number            INTEGER;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS completed_by            UUID;
ALTER TABLE hk_tasks ADD COLUMN IF NOT EXISTS hk_status               TEXT;

-- Drop old FK on assigned_to (was pointing to users)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hk_tasks_assigned_to_fkey' AND table_name = 'hk_tasks'
  ) THEN
    ALTER TABLE hk_tasks DROP CONSTRAINT hk_tasks_assigned_to_fkey;
  END IF;
END $$;

-- Nullify assigned_to values that don't exist in hk_staff_profiles
-- (since we're switching FK target, old user UUIDs won't match)
UPDATE hk_tasks SET assigned_to = NULL
  WHERE assigned_to IS NOT NULL
  AND assigned_to NOT IN (SELECT id FROM hk_staff_profiles);

-- Add new FK: hk_tasks.assigned_to → hk_staff_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hk_tasks_assigned_to_hk_fkey' AND table_name = 'hk_tasks'
  ) THEN
    ALTER TABLE hk_tasks
      ADD CONSTRAINT hk_tasks_assigned_to_hk_fkey
      FOREIGN KEY (assigned_to) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK: hk_tasks.completed_by → hk_staff_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hk_tasks_completed_by_hk_fkey' AND table_name = 'hk_tasks'
  ) THEN
    ALTER TABLE hk_tasks
      ADD CONSTRAINT hk_tasks_completed_by_hk_fkey
      FOREIGN KEY (completed_by) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Fix rooms: add HK-specific columns used by dashboard.controller.ts
-- and rooms.controller.ts (housekeeping)
-- ---------------------------------------------------------------
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hk_status             TEXT DEFAULT 'clean';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS cleaning_priority     TEXT DEFAULT 'normal';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_vip                BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS assigned_attendant_id UUID;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_cleaned_at       TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expected_checkout     TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS dnd_start_time        TIMESTAMPTZ;

-- Backfill hk_status from housekeeping_status if it exists
UPDATE rooms SET hk_status = housekeeping_status
  WHERE hk_status = 'clean' AND housekeeping_status IS NOT NULL AND housekeeping_status != '';

-- FK: rooms.assigned_attendant_id → hk_staff_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'rooms_assigned_attendant_id_fkey' AND table_name = 'rooms'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_assigned_attendant_id_fkey
      FOREIGN KEY (assigned_attendant_id) REFERENCES hk_staff_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rooms_hk_status              ON rooms(hk_status);
CREATE INDEX IF NOT EXISTS idx_rooms_assigned_attendant     ON rooms(assigned_attendant_id);

-- ---------------------------------------------------------------
-- Add missing column to hk_room_status_history used by rooms.controller.ts
-- Controller selects: previous_status, new_status, reason, changed_by
-- DB has: old_status, new_status — 'previous_status' and 'reason' are missing
-- ---------------------------------------------------------------
ALTER TABLE hk_room_status_history ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE hk_room_status_history ADD COLUMN IF NOT EXISTS reason          TEXT;

-- Backfill previous_status from old_status
UPDATE hk_room_status_history SET previous_status = old_status WHERE previous_status IS NULL;

-- Sync trigger
CREATE OR REPLACE FUNCTION sync_hk_room_history_cols()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.old_status IS NOT NULL AND NEW.previous_status IS NULL THEN
    NEW.previous_status := NEW.old_status;
  ELSIF NEW.previous_status IS NOT NULL AND NEW.old_status IS NULL THEN
    NEW.old_status := NEW.previous_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_hk_room_history ON hk_room_status_history;
CREATE TRIGGER trg_sync_hk_room_history
  BEFORE INSERT OR UPDATE ON hk_room_status_history
  FOR EACH ROW EXECUTE FUNCTION sync_hk_room_history_cols();
