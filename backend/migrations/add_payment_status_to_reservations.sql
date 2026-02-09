-- Add payment_status column to reservations table
ALTER TABLE reservations 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';

-- Add check constraint to ensure valid values (matching PaymentStatus enum)
ALTER TABLE reservations 
ADD CONSTRAINT check_payment_status 
CHECK (payment_status IN ('pending', 'paid', 'partial', 'refunded'));

-- Update existing records to have a default value if needed (though DEFAULT handles new ones)
UPDATE reservations 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;
