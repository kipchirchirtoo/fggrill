-- BAR MODULE FUNCTIONS - Famous Gate Hotel
-- Created: 2025-11-28

-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_bar_stock(p_drink_id UUID, p_branch_id INTEGER, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE bar_stock
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE drink_id = p_drink_id AND branch_id = p_branch_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check for low stock
-- This can be used by a scheduled job or trigger to send alerts
CREATE OR REPLACE FUNCTION check_low_stock(p_branch_id INTEGER)
RETURNS TABLE (
  drink_name VARCHAR,
  current_quantity INTEGER,
  min_stock INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.name,
    s.quantity,
    s.min_stock
  FROM bar_stock s
  JOIN bar_drinks d ON s.drink_id = d.id
  WHERE s.branch_id = p_branch_id
  AND s.quantity <= s.min_stock;
END;
$$ LANGUAGE plpgsql;
