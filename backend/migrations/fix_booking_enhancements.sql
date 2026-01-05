-- Migration: Fix booking system enhancements
-- Date: 2024-12-15
-- Description: Fix database schema issues and add necessary columns properly

-- First, let's check the actual structure of branches table
-- and add columns without foreign key constraints initially

DO $$ 
BEGIN
    -- Add branch_id column as integer to match branches table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservations' AND column_name = 'branch_id') THEN
        ALTER TABLE reservations ADD COLUMN branch_id INTEGER;
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

END $$;

-- Update existing reservations to have proper confirmation numbers
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
BEGIN
    FOR rec IN SELECT id, created_at FROM reservations 
               WHERE confirmation_number IS NULL 
               OR confirmation_number = '' 
               OR confirmation_number LIKE 'RES-%'
               ORDER BY created_at
    LOOP
        UPDATE reservations 
        SET confirmation_number = 'HTL' || TO_CHAR(rec.created_at, 'YYMMDD') || '-' || LPAD(counter::TEXT, 4, '0')
        WHERE id = rec.id;
        
        counter := counter + 1;
    END LOOP;
END $$;

-- Update existing reservations with calculated values
UPDATE reservations SET 
    booking_source = COALESCE(booking_source, 'WALK_IN'),
    infants = COALESCE(infants, 0),
    service_charge = COALESCE(service_charge, 0),
    discount_amount = COALESCE(discount_amount, 0)
WHERE booking_source IS NULL OR infants IS NULL OR service_charge IS NULL OR discount_amount IS NULL;

-- Calculate subtotal and room_rate for existing records
UPDATE reservations SET 
    subtotal = CASE 
        WHEN subtotal = 0 OR subtotal IS NULL THEN total_amount * 0.862 
        ELSE subtotal 
    END,
    room_rate = CASE 
        WHEN room_rate = 0 OR room_rate IS NULL THEN 
            total_amount / GREATEST(EXTRACT(DAY FROM (check_out_date - check_in_date)), 1)
        ELSE room_rate 
    END
WHERE subtotal = 0 OR subtotal IS NULL OR room_rate = 0 OR room_rate IS NULL;

-- Create indexes for better performance (only if columns exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'branch_id') THEN
        CREATE INDEX IF NOT EXISTS idx_reservations_branch_id ON reservations(branch_id);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'booking_source') THEN
        CREATE INDEX IF NOT EXISTS idx_reservations_booking_source ON reservations(booking_source);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_number ON reservations(confirmation_number);

-- Add comments for documentation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'booking_source') THEN
        COMMENT ON COLUMN reservations.booking_source IS 'Source of the booking (WEBSITE, WALK_IN, PHONE, etc.)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'meal_plan') THEN
        COMMENT ON COLUMN reservations.meal_plan IS 'Selected meal plan (bed_breakfast, half_board, full_board, all_inclusive)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'special_requests') THEN
        COMMENT ON COLUMN reservations.special_requests IS 'Guest special requests and preferences';
    END IF;
END $$;
