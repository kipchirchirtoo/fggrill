-- =====================================================
-- GRN INVENTORY LOGIC FIX
-- Ensures stock is ONLY updated when GRN is approved
-- =====================================================

-- 1. Remove legacy immediate stock update trigger
DROP TRIGGER IF EXISTS process_grn_receipt_trigger ON store_grn_items;

-- 2. Create function to update inventory from GRN items
CREATE OR REPLACE FUNCTION update_inventory_from_approved_grn()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
  v_grn_item RECORD;
BEGIN
  -- Only proceed if GRN is being approved
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    
    -- Loop through all items in this GRN
    FOR v_grn_item IN (SELECT * FROM store_grn_items WHERE grn_id = NEW.id) LOOP
      
      -- Get item details
      SELECT * INTO v_item_record FROM store_items WHERE id = v_grn_item.item_id;
      
      -- Update item stock (only for accepted quantity)
      IF v_grn_item.accepted_quantity > 0 THEN
        
        -- Batch tracking
        IF v_item_record.track_batch_number AND v_grn_item.batch_number IS NOT NULL THEN
          INSERT INTO store_item_batches (
            item_id,
            batch_number,
            quantity,
            remaining_quantity,
            expiry_date,
            received_date,
            supplier_id,
            unit_cost
          ) VALUES (
            v_grn_item.item_id,
            v_grn_item.batch_number,
            v_grn_item.accepted_quantity,
            v_grn_item.accepted_quantity,
            v_grn_item.expiry_date_found,
            CURRENT_DATE,
            NEW.supplier_id,
            v_grn_item.unit_price
          )
          ON CONFLICT (item_id, batch_number) 
          DO UPDATE SET
            quantity = store_item_batches.quantity + EXCLUDED.quantity,
            remaining_quantity = store_item_batches.remaining_quantity + EXCLUDED.remaining_quantity,
            updated_at = NOW()
          RETURNING id INTO v_batch_id;
        END IF;

        -- Update item master
        UPDATE store_items
        SET 
          current_stock = current_stock + v_grn_item.accepted_quantity,
          last_purchase_cost = v_grn_item.unit_price,
          average_cost = CASE
            WHEN current_stock + v_grn_item.accepted_quantity > 0 THEN
              ((current_stock * average_cost) + (v_grn_item.accepted_quantity * v_grn_item.unit_price)) / 
              (current_stock + v_grn_item.accepted_quantity)
            ELSE v_grn_item.unit_price
          END,
          updated_at = NOW()
        WHERE id = v_grn_item.item_id;

        -- Log stock movement
        INSERT INTO store_stock_movements (
          movement_number,
          item_id,
          batch_id,
          movement_type,
          movement_date,
          quantity,
          unit_cost,
          total_value,
          stock_before,
          stock_after,
          reference_type,
          reference_id,
          reference_number,
          notes,
          performed_by_id
        ) VALUES (
          generate_movement_number(),
          v_grn_item.item_id,
          v_batch_id,
          'receipt',
          CURRENT_DATE,
          v_grn_item.accepted_quantity,
          v_grn_item.unit_price,
          (v_grn_item.accepted_quantity * v_grn_item.unit_price),
          v_item_record.current_stock,
          v_item_record.current_stock + v_grn_item.accepted_quantity,
          'grn',
          NEW.id,
          NEW.grn_number,
          'Goods received and approved via GRN',
          NEW.approved_by_id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger for inventory update on GRN approval
DROP TRIGGER IF EXISTS update_inventory_on_grn_approval_trigger ON store_grn;
CREATE TRIGGER update_inventory_on_grn_approval_trigger
  AFTER UPDATE OF grn_approved ON store_grn
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_from_approved_grn();

-- 4. Create wrapping function for controller to call (Atomic Approval)
CREATE OR REPLACE FUNCTION approve_grn_and_update_all(
  p_grn_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_grn_record RECORD;
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
  
  -- The triggers added in previous migrations will handle:
  -- - update_inventory_on_grn_approval_trigger (Stock & Movements)
  -- - update_po_item_from_grn_trigger (PO status)
  -- - create_grni_on_grn_approval_trigger (Accounting - GRNI & Journal Entries)
  -- - audit_grn_approval_trigger (Audit Logs)
  
  RETURN to_jsonb(v_grn_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
