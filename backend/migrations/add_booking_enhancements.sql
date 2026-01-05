-- Migration: Add booking system enhancements
-- Date: 2024-12-15
-- Description: Add necessary columns and tables for enhanced booking system with barcode support

-- Add missing columns to reservations table if they don't exist
DO $$ 
BEGIN
    -- Add branch_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'branch_id') THEN
        ALTER TABLE reservations ADD COLUMN branch_id UUID REFERENCES branches(id);
    END IF;

    -- Add booking_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'booking_source') THEN
        ALTER TABLE reservations ADD COLUMN booking_source VARCHAR(50) DEFAULT 'WALK_IN';
    END IF;

    -- Add meal_plan column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'meal_plan') THEN
        ALTER TABLE reservations ADD COLUMN meal_plan VARCHAR(50);
    END IF;

    -- Add purpose column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'purpose') THEN
        ALTER TABLE reservations ADD COLUMN purpose VARCHAR(100);
    END IF;

    -- Add special_requests column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'special_requests') THEN
        ALTER TABLE reservations ADD COLUMN special_requests TEXT;
    END IF;

    -- Add notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'notes') THEN
        ALTER TABLE reservations ADD COLUMN notes TEXT;
    END IF;

    -- Add internal_notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'internal_notes') THEN
        ALTER TABLE reservations ADD COLUMN internal_notes TEXT;
    END IF;

    -- Add infants column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'infants') THEN
        ALTER TABLE reservations ADD COLUMN infants INTEGER DEFAULT 0;
    END IF;

    -- Add service_charge column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'service_charge') THEN
        ALTER TABLE reservations ADD COLUMN service_charge DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add discount_amount column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'discount_amount') THEN
        ALTER TABLE reservations ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add subtotal column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'subtotal') THEN
        ALTER TABLE reservations ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add room_rate column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'room_rate') THEN
        ALTER TABLE reservations ADD COLUMN room_rate DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Update status enum to include 'modified' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'modified' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')) THEN
        ALTER TYPE booking_status ADD VALUE 'modified';
    END IF;

END $$;

-- Create booking_history table for tracking changes
CREATE TABLE IF NOT EXISTS booking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_branch_id ON reservations(branch_id);
CREATE INDEX IF NOT EXISTS idx_reservations_booking_source ON reservations(booking_source);
CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_number ON reservations(confirmation_number);
CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON booking_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_history_created_at ON booking_history(created_at);

-- Create email_logs table for tracking email communications
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- Update existing reservations to have proper confirmation numbers if they don't
UPDATE reservations 
SET confirmation_number = 'HTL' || TO_CHAR(created_at, 'YYMMDD') || '-' || LPAD((ROW_NUMBER() OVER (ORDER BY created_at))::TEXT, 4, '0')
WHERE confirmation_number IS NULL OR confirmation_number = '' OR confirmation_number LIKE 'RES-%';

-- Ensure all reservations have proper default values
UPDATE reservations SET 
    booking_source = COALESCE(booking_source, 'WALK_IN'),
    infants = COALESCE(infants, 0),
    service_charge = COALESCE(service_charge, 0),
    discount_amount = COALESCE(discount_amount, 0),
    subtotal = COALESCE(subtotal, total_amount * 0.862),
    room_rate = COALESCE(room_rate, total_amount / GREATEST(EXTRACT(DAY FROM (check_out_date - check_in_date)), 1))
WHERE subtotal = 0 OR room_rate = 0;

-- Create function to automatically log booking changes
CREATE OR REPLACE FUNCTION log_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO booking_history (booking_id, action, description, old_data, new_data, changed_by)
        VALUES (
            NEW.id,
            'UPDATE',
            'Booking details updated',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO booking_history (booking_id, action, description, new_data, changed_by)
        VALUES (
            NEW.id,
            'CREATE',
            'Booking created',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking history
DROP TRIGGER IF EXISTS booking_changes_trigger ON reservations;
CREATE TRIGGER booking_changes_trigger
    AFTER INSERT OR UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION log_booking_changes();

-- Add comments for documentation
COMMENT ON TABLE booking_history IS 'Tracks all changes made to bookings for audit purposes';
COMMENT ON TABLE email_logs IS 'Logs all email communications related to bookings';
COMMENT ON COLUMN reservations.booking_source IS 'Source of the booking (WEBSITE, WALK_IN, PHONE, etc.)';
COMMENT ON COLUMN reservations.meal_plan IS 'Selected meal plan (bed_breakfast, half_board, full_board, all_inclusive)';
COMMENT ON COLUMN reservations.special_requests IS 'Guest special requests and preferences';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON booking_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_logs TO authenticated;

COMMIT;
