-- =====================================================
-- ADD INVOICE_NUMBER COLUMN TO CONFERENCE_HALL_BOOKINGS
-- Created: April 10, 2026
-- Purpose: Fix CNF- invoice lookup in cashier system
-- =====================================================

-- Add invoice_number column to conference_hall_bookings
ALTER TABLE conference_hall_bookings 
ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_conference_hall_bookings_invoice_number 
ON conference_hall_bookings(invoice_number);

-- Backfill existing records by extracting invoice_number from notes metadata
UPDATE conference_hall_bookings
SET invoice_number = (
    SELECT (regexp_match(notes, '"invoice_number":"([^"]+)"'))[1]
    WHERE notes LIKE '%__METADATA__%'
      AND notes LIKE '%invoice_number%'
)
WHERE invoice_number IS NULL 
  AND notes LIKE '%__METADATA__%';

-- Add comment
COMMENT ON COLUMN conference_hall_bookings.invoice_number IS 'Unique invoice number for conference bookings (format: CNF-YYYYMMDD-XXXX)';
