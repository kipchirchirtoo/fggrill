-- Add missing columns to rooms table required by booking controller
DO $$ 
BEGIN
    -- Add check_in column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rooms' AND column_name = 'check_in') THEN
        ALTER TABLE rooms ADD COLUMN check_in TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add check_out column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rooms' AND column_name = 'check_out') THEN
        ALTER TABLE rooms ADD COLUMN check_out DATE; -- Booking uses date, but controller passes check_out_date which is date. Let's check type.
    END IF;
END $$;
