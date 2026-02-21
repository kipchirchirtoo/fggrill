-- =====================================================
-- FIX MENU ITEMS PREPARATION TIME
-- =====================================================
-- Make preparation_time nullable with default value
-- This allows Super Admin to add menu items without specifying prep time

-- Remove the NOT NULL constraint and add a default value
ALTER TABLE restaurant_menu_items 
ALTER COLUMN preparation_time DROP NOT NULL,
ALTER COLUMN preparation_time SET DEFAULT 15;

-- Drop the old check constraint
ALTER TABLE restaurant_menu_items 
DROP CONSTRAINT IF EXISTS valid_prep_time;

-- Add new check constraint that allows NULL or positive values
ALTER TABLE restaurant_menu_items 
ADD CONSTRAINT valid_prep_time CHECK (preparation_time IS NULL OR preparation_time > 0);

-- Update existing NULL values to default
UPDATE restaurant_menu_items 
SET preparation_time = 15 
WHERE preparation_time IS NULL;

COMMENT ON COLUMN restaurant_menu_items.preparation_time IS 'Preparation time in minutes (defaults to 15 if not specified)';

