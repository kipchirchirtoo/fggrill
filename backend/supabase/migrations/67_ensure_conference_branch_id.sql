-- =====================================================
-- ENSURE CONFERENCE_HALL_BOOKINGS HAS BRANCH_ID
-- Migration: 67_ensure_conference_branch_id.sql
-- Created: April 10, 2026
-- Purpose: Ensure conference bookings are properly linked to branches
-- =====================================================

-- Add branch_id column if it doesn't exist
ALTER TABLE conference_hall_bookings 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

-- Create index for fast branch filtering
CREATE INDEX IF NOT EXISTS idx_conference_hall_bookings_branch_id 
ON conference_hall_bookings(branch_id);

-- Backfill branch_id from conference_halls for existing records
UPDATE conference_hall_bookings chb
SET branch_id = ch.branch_id
FROM conference_halls ch
WHERE chb.conference_hall_id = ch.id
AND chb.branch_id IS NULL;

-- Add comment
COMMENT ON COLUMN conference_hall_bookings.branch_id IS 'Branch where the conference booking was made';
