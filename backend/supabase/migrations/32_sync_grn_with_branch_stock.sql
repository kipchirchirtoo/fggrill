-- =====================================================
-- SYNC GRN WITH BRANCH STOCK
-- Ensures Central Store Receiving updates branch_stock
-- =====================================================

CREATE OR REPLACE FUNCTION update_inventory_from_approved_grn()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
  v_grn_item RECORD;
  v_central_branch_id INT;
  v_sku TEXT;
  v_prev_branch_stock INT;
  v_new_branch_stock INT;
BEGIN
  -- Only proceed if GRN is being approved
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    
    -- Get central branch ID
    SELECT id INTO v_central_branch_id FROM branches WHERE is_central_warehouse = true LIMIT 1;
    
    -- Loop through all items in this GRN
    FOR v_grn_item IN (SELECT * FROM store_grn_items WHERE grn_id = NEW.id) LOOP
      
      -- Get item details
      SELECT * INTO v_item_record FROM store_items WHERE id = v_grn_item.item_id;
      v_sku := v_item_record.sku;
      
      -- Update item stock (only for accepted quantity)
      IF v_grn_item.accepted_quantity > 0 THEN
        
        -- 1. Original Storekeeping Updates (store_items & batches)
        
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
            v_grn_item.expiry_date, -- Updated from original code which had expiry_date_found
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

        -- Log store stock movement (Legacy)
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
          COALESCE((SELECT 'MOV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD((COUNT(*)+1)::TEXT, 4, '0') FROM store_stock_movements), 'MOV-INIT-0001'),
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

        -- 2. New Multi-Branch Synchronization (branch_stock)
        
        IF v_central_branch_id IS NOT NULL AND v_sku IS NOT NULL THEN
            -- Get previous branch stock
            SELECT quantity INTO v_prev_branch_stock FROM branch_stock 
            WHERE branch_id = v_central_branch_id AND item_sku = v_sku;
            
            IF v_prev_branch_stock IS NULL THEN v_prev_branch_stock := 0; END IF;
            
            -- Upsert branch stock
            INSERT INTO branch_stock (branch_id, item_sku, quantity, last_stock_in, updated_at)
            VALUES (v_central_branch_id, v_sku, v_grn_item.accepted_quantity, NOW(), NOW())
            ON CONFLICT (branch_id, item_sku) 
            DO UPDATE SET 
                quantity = branch_stock.quantity + EXCLUDED.quantity,
                last_stock_in = EXCLUDED.last_stock_in,
                updated_at = EXCLUDED.updated_at
            RETURNING quantity INTO v_new_branch_stock;
            
            -- Log branch movement
            INSERT INTO branch_stock_movements (
                branch_id,
                item_sku,
                movement_type,
                quantity,
                previous_stock,
                new_stock,
                reference_type,
                reference_id,
                reference_number,
                performed_by,
                notes
            ) VALUES (
                v_central_branch_id,
                v_sku,
                'PURCHASE',
                v_grn_item.accepted_quantity,
                v_prev_branch_stock,
                v_new_branch_stock,
                'DISPATCH_RECEIVE', -- Using existing enum value or suitable one
                NEW.id,
                NEW.grn_number,
                NEW.approved_by_id,
                'Sync from Central Store GRN: ' || NEW.grn_number
            );
        END IF;

      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
