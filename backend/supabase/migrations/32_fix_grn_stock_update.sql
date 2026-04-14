-- =====================================================
-- FIX GRN APPROVAL TO UPDATE CENTRAL STORE STOCK
-- Updates simple_items.quantity when GRN is approved
-- =====================================================

-- Drop the existing function
DROP FUNCTION IF EXISTS approve_grn_and_update_all(UUID, UUID);

-- Create improved function that updates simple_items stock
CREATE OR REPLACE FUNCTION approve_grn_and_update_all(
  p_grn_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_grn_record RECORD;
  v_grn_item RECORD;
  v_item_sku VARCHAR(50);
  v_current_stock INTEGER;
BEGIN
  -- 1. Check if GRN exists and is not already approved
  SELECT * INTO v_grn_record FROM store_grn WHERE id = p_grn_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;
  
  IF v_grn_record.grn_approved = true THEN
    RAISE EXCEPTION 'GRN is already approved';
  END IF;
  
  -- 2. Update GRN to approved
  UPDATE store_grn
  SET 
    grn_approved = true,
    approved_by_id = p_approved_by,
    approved_at = NOW(),
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_grn_id
  RETURNING * INTO v_grn_record;
  
  -- 3. Update simple_items stock for each GRN item
  FOR v_grn_item IN (
    SELECT 
      gi.item_id,
      gi.quantity_accepted,
      gi.quantity_received,
      gi.unit_price
    FROM store_grn_items gi
    WHERE gi.grn_id = p_grn_id
  ) LOOP
    
    -- Get the item SKU from item_id
    -- Assuming item_id is the SKU in simple_items
    v_item_sku := v_grn_item.item_id;
    
    -- Get current stock
    SELECT COALESCE(quantity, 0) INTO v_current_stock
    FROM simple_items
    WHERE sku = v_item_sku;
    
    -- Update simple_items stock (add accepted quantity)
    UPDATE simple_items
    SET 
      quantity = COALESCE(quantity, 0) + COALESCE(v_grn_item.quantity_accepted, v_grn_item.quantity_received, 0),
      cost_price = COALESCE(v_grn_item.unit_price, cost_price),
      updated_at = NOW()
    WHERE sku = v_item_sku;
    
    -- Log the stock movement (optional but recommended)
    -- If you have a stock_movements table for central store, log it here
    -- INSERT INTO central_stock_movements (...) VALUES (...);
    
  END LOOP;
  
  RETURN to_jsonb(v_grn_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION approve_grn_and_update_all(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION approve_grn_and_update_all IS 'Approves GRN and updates central store inventory (simple_items table)';
