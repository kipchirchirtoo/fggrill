-- Add snapshot audit columns to cashier_shift_logs
ALTER TABLE cashier_shift_logs
ADD COLUMN IF NOT EXISTS snapshot_calculated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS snapshot_calculation_version VARCHAR(255),
ADD COLUMN IF NOT EXISTS snapshot_transaction_count INTEGER DEFAULT 0;
