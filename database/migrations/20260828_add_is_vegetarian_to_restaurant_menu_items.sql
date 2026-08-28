-- Add is_vegetarian column to restaurant_menu_items if not present
ALTER TABLE restaurant_menu_items 
ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN DEFAULT FALSE;
