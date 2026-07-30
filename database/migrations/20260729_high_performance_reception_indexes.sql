-- High-Performance Reception Database Indexes
-- Created: 2026-07-29

-- 1. Reservations Table (High-frequency filtering & joins)
CREATE INDEX IF NOT EXISTS idx_reservations_status_created 
ON reservations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_room_id 
ON reservations (room_id);

CREATE INDEX IF NOT EXISTS idx_reservations_guest_id 
ON reservations (guest_id);

CREATE INDEX IF NOT EXISTS idx_reservations_check_in_out 
ON reservations (check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_number 
ON reservations (confirmation_number);

-- 2. Rooms Table (Branch & Status filtering)
CREATE INDEX IF NOT EXISTS idx_rooms_branch_status 
ON rooms (branch_id, status);

-- 3. Guests Table
CREATE INDEX IF NOT EXISTS idx_guests_branch_id 
ON guests (branch_id);

-- 4. Housekeeping Tasks
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status 
ON housekeeping_tasks (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_room_id 
ON housekeeping_tasks (room_id);

-- 5. Conference & Catering Bookings
CREATE INDEX IF NOT EXISTS idx_conference_bookings_status 
ON conference_bookings (status);

CREATE INDEX IF NOT EXISTS idx_catering_bookings_status 
ON catering_bookings (status);
