-- Fix log_booking_changes function to use auth.uid() instead of missing updated_by column
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
            auth.uid() -- Changed from NEW.updated_by which doesn't exist
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

-- Add missing current_guest column to rooms table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'rooms' AND column_name = 'current_guest') THEN
        ALTER TABLE rooms ADD COLUMN current_guest UUID REFERENCES guests(id);
    END IF;
END $$;
