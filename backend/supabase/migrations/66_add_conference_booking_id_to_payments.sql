-- =====================================================
-- ADD CONFERENCE_BOOKING_ID TO PAYMENTS TABLE
-- Created: April 10, 2026
-- Purpose: Support conference booking payments in cashier system
-- =====================================================

-- Add conference_booking_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS conference_booking_id UUID;

-- Add foreign key constraint to conference_hall_bookings
ALTER TABLE payments
ADD CONSTRAINT payments_conference_booking_id_fkey 
FOREIGN KEY (conference_booking_id) 
REFERENCES conference_hall_bookings(id) 
ON DELETE CASCADE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_payments_conference_booking_id 
ON payments(conference_booking_id);

-- Add comment
COMMENT ON COLUMN payments.conference_booking_id IS 'Foreign key to conference_hall_bookings table for conference payments';
