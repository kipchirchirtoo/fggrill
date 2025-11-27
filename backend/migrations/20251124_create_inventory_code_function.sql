-- Function to generate inventory item code
CREATE OR REPLACE FUNCTION generate_inventory_code()
RETURNS TEXT AS $$
DECLARE
  counter INT;
  inv_code TEXT;
BEGIN
  -- Get the current highest number from existing codes
  SELECT COALESCE(MAX(SUBSTRING(item_code FROM 'INV:(\d{4})')::INT), 0) + 1
  INTO counter
  FROM inventory_items
  WHERE item_code ~ '^INV:\d{4}$';
  
  -- Format the code with leading zeros
  inv_code := 'INV:' || LPAD(counter::TEXT, 4, '0');
  RETURN inv_code;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically generate inventory code
CREATE OR REPLACE FUNCTION set_inventory_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.item_code IS NULL THEN
    NEW.item_code := generate_inventory_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_inventory_code_trigger ON inventory_items;

-- Create trigger
CREATE TRIGGER set_inventory_code_trigger
  BEFORE INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION set_inventory_code();
