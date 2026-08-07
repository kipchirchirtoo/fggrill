-- Migration: Add missing columns causing Postgres errors and statement timeouts
-- Date: 2026-08-07

ALTER TABLE cashier_shift_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';
ALTER TABLE unpaid_bills ADD COLUMN IF NOT EXISTS scan_reference VARCHAR(100);
ALTER TABLE conference_hall_bookings ADD COLUMN IF NOT EXISTS short_code VARCHAR(50);
ALTER TABLE credit_bills ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE staff_attendance ALTER COLUMN staff_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
