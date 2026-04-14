-- =====================================================
-- FIX GRN APPROVAL TYPE CASTING
-- Handles item_id as both UUID and VARCHAR
-- =====================================================

DROP FUNCTION IF EXISTS approve_grn_and_update_all(UUID, UUID);

CREATE OR REPLACE FUNCTION approve_grn_and_update_all(
  p_grn_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_grn_record RECORD;
  v_grn_item RECORD;
  v_item_sku VARCHAR(50);
  v_current_stock NUMERIC;
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
      gi.item_id::TEXT as item_id,  -- Cast to TEXT to handle both UUID and VARCHAR
      COALESCE(gi.quantity_accepted, gi.quantity_received, 0) as quantity,
      gi.unit_price
    FROM store_grn_items gi
    WHERE gi.grn_id = p_grn_id
  ) LOOP
    
    -- item_id is the SKU in simple_items
    v_item_sku := v_grn_item.item_id;
    
    -- Get current stock
    SELECT COALESCE(quantity, 0) INTO v_current_stock
    FROM simple_items
    WHERE sku = v_item_sku;
    
    -- If item doesn't exist, skip (shouldn't happen but safe)
    IF NOT FOUND THEN
      RAISE NOTICE 'Item % not found in simple_items, skipping', v_item_sku;
      CONTINUE;
    END IF;
    
    -- Update simple_items stock (add accepted quantity)
    UPDATE simple_items
    SET 
      quantity = COALESCE(quantity, 0) + v_grn_item.quantity,
      cost_price = COALESCE(v_grn_item.unit_price, cost_price)
    WHERE sku = v_item_sku;
    
    RAISE NOTICE 'Updated % stock: % + % = %', 
      v_item_sku, 
      v_current_stock, 
      v_grn_item.quantity, 
      v_current_stock + v_grn_item.quantity;
    
  END LOOP;
  
  RETURN to_jsonb(v_grn_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION approve_grn_and_update_all(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION approve_grn_and_update_all IS 'Approves GRN and updates central store inventory with type casting support';
