-- Migration: Fix booking calculations
-- Date: 2024-12-15
-- Description: Fix calculation issues in booking enhancements

-- Update existing reservations with calculated values (fixed version)
UPDATE reservations SET 
    subtotal = CASE 
        WHEN subtotal = 0 OR subtotal IS NULL THEN total_amount * 0.862 
        ELSE subtotal 
    END,
    room_rate = CASE 
        WHEN room_rate = 0 OR room_rate IS NULL THEN 
            total_amount / GREATEST(EXTRACT(DAY FROM (check_out_date::timestamp - check_in_date::timestamp)), 1)
        ELSE room_rate 
    END
WHERE subtotal = 0 OR subtotal IS NULL OR room_rate = 0 OR room_rate IS NULL;
