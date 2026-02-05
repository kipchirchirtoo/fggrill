-- Migration: Add is_bar column to restaurant_menu_categories
-- Goal: Distinguish between bar and restaurant menu categories for better POS filtering.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_menu_categories' AND column_name = 'is_bar') THEN
        ALTER TABLE restaurant_menu_categories ADD COLUMN is_bar BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update existing categories based on keywords
UPDATE restaurant_menu_categories 
SET is_bar = TRUE 
WHERE LOWER(name) ~ '(beverage|drink|beer|wine|cocktail|spirit|juice|tea|coffee|water|soda|shisha|liquor|whiskey|vodka|gin|rum|brandy|tequila)';
