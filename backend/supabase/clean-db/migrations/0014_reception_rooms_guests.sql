-- =============================================================
-- 0014: Reception Module - Rooms and Guests missing columns
-- =============================================================

-- -------------------------
-- ROOMS
-- -------------------------

-- Used in updateRoom() and updateRoomStatus()
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;

-- Set when room status changes to 'cleaning' in updateRoomStatus()
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_cleaned TIMESTAMPTZ;

-- FK to currently checked-in guest; used in getRooms() join and deleteGuest() check
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_guest UUID REFERENCES guests(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_branch        ON rooms(branch_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status        ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_current_guest ON rooms(current_guest);

-- -------------------------
-- GUESTS
-- -------------------------

-- Used in Guest model notes field
ALTER TABLE guests ADD COLUMN IF NOT EXISTS notes TEXT;

-- Used in Guest model city/country fields
ALTER TABLE guests ADD COLUMN IF NOT EXISTS city    TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS country TEXT;

-- blacklist_status should be boolean per model, but DB has text.
-- Add boolean column; keep the text one for backward compat.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS blacklist_status_bool BOOLEAN DEFAULT FALSE;
UPDATE guests SET blacklist_status_bool = (blacklist_status = 'true' OR blacklist_status = 'blacklisted')
  WHERE blacklist_status IS NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guests_email     ON guests(email);
CREATE INDEX IF NOT EXISTS idx_guests_id_number ON guests(id_number);
CREATE INDEX IF NOT EXISTS idx_guests_phone     ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_branch    ON guests(branch_id);
