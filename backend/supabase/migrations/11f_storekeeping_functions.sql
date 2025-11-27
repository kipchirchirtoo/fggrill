-- =====================================================
-- STOREKEEPING MODULE - ADVANCED FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update item stock on GRN
CREATE OR REPLACE FUNCTION process_grn_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
BEGIN
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Create or update batch if batch tracking is enabled
  IF v_item_record.track_batch_number THEN
    INSERT INTO store_item_batches (
      item_id,
      batch_number,
      quantity,
      remaining_quantity,
      manufacturing_date,
      expiry_date,
      received_date,
      supplier_id,
      unit_cost,
      storage_location_id
    ) VALUES (
      NEW.item_id,
      NEW.batch_number,
      NEW.quantity_accepted,
      NEW.quantity_accepted,
      NEW.manufacturing_date,
      NEW.expiry_date,
      CURRENT_DATE,
      (SELECT supplier_id FROM store_grn WHERE id = NEW.grn_id),
      NEW.unit_price,
      NEW.storage_location_id
    )
    ON CONFLICT (item_id, batch_number) 
    DO UPDATE SET
      quantity = store_item_batches.quantity + NEW.quantity_accepted,
      remaining_quantity = store_item_batches.remaining_quantity + NEW.quantity_accepted
    RETURNING id INTO v_batch_id;
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = current_stock + NEW.quantity_accepted,
    last_purchase_cost = NEW.unit_price,
    average_cost = CASE
      WHEN current_stock + NEW.quantity_accepted > 0 THEN
        ((current_stock * average_cost) + (NEW.quantity_accepted * NEW.unit_price)) / 
        (current_stock + NEW.quantity_accepted)
      ELSE NEW.unit_price
    END,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Create stock movement record
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
    to_location_id,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by_id
  ) VALUES (
    generate_movement_number(),
    NEW.item_id,
    v_batch_id,
    'receipt',
    CURRENT_DATE,
    NEW.quantity_accepted,
    NEW.unit_price,
    NEW.total_value,
    v_item_record.current_stock,
    v_item_record.current_stock + NEW.quantity_accepted,
    NEW.storage_location_id,
    'grn',
    NEW.grn_id,
    (SELECT grn_number FROM store_grn WHERE id = NEW.grn_id),
    'Goods received via GRN',
    (SELECT received_by_id FROM store_grn WHERE id = NEW.grn_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_grn_receipt_trigger
  AFTER INSERT ON store_grn_items
  FOR EACH ROW
  EXECUTE FUNCTION process_grn_receipt();

-- Function to process stock issue
CREATE OR REPLACE FUNCTION process_stock_issue()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_batch_id UUID;
  v_issue_record RECORD;
BEGIN
  -- Get issue details
  SELECT * INTO v_issue_record FROM store_stock_issues WHERE id = NEW.issue_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Check if sufficient stock
  IF v_item_record.current_stock < NEW.quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock for item %. Available: %, Required: %', 
      v_item_record.name, v_item_record.current_stock, NEW.quantity_issued;
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = current_stock - NEW.quantity_issued,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Update batch if batch tracking
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE store_item_batches
    SET remaining_quantity = remaining_quantity - NEW.quantity_issued
    WHERE id = NEW.batch_id;
  END IF;
  
  -- Create stock movement record
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
    from_location_id,
    to_department_id,
    reference_type,
    reference_id,
    reference_number,
    notes,
    performed_by_id
  ) VALUES (
    generate_movement_number(),
    NEW.item_id,
    NEW.batch_id,
    'issue',
    CURRENT_DATE,
    NEW.quantity_issued,
    NEW.unit_cost,
    NEW.total_value,
    v_item_record.current_stock,
    v_item_record.current_stock - NEW.quantity_issued,
    v_item_record.storage_location_id,
    v_issue_record.department_id,
    'issue',
    NEW.issue_id,
    v_issue_record.issue_number,
    'Stock issued to department',
    v_issue_record.issued_by_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_issue_trigger
  AFTER UPDATE OF quantity_issued ON store_issue_items
  FOR EACH ROW
  WHEN (NEW.quantity_issued > OLD.quantity_issued)
  EXECUTE FUNCTION process_stock_issue();

-- Function to process stock return
CREATE OR REPLACE FUNCTION process_stock_return()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_return_record RECORD;
BEGIN
  -- Get return details
  SELECT * INTO v_return_record FROM store_stock_returns WHERE id = NEW.return_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Update item stock (only if condition is good)
  IF NEW.condition = 'good' THEN
    UPDATE store_items
    SET 
      current_stock = current_stock + NEW.quantity_returned,
      updated_at = NOW()
    WHERE id = NEW.item_id;
    
    -- Update batch if applicable
    IF NEW.batch_id IS NOT NULL THEN
      UPDATE store_item_batches
      SET remaining_quantity = remaining_quantity + NEW.quantity_returned
      WHERE id = NEW.batch_id;
    END IF;
    
    -- Create stock movement record
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
      to_location_id,
      from_department_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'return',
      CURRENT_DATE,
      NEW.quantity_returned,
      NEW.unit_cost,
      NEW.total_value,
      v_item_record.current_stock,
      v_item_record.current_stock + NEW.quantity_returned,
      v_item_record.storage_location_id,
      v_return_record.department_id,
      'return',
      NEW.return_id,
      v_return_record.return_number,
      'Stock returned from department - ' || NEW.condition,
      v_return_record.received_by_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_return_trigger
  AFTER INSERT ON store_return_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_return();

-- Function to process stock transfer
CREATE OR REPLACE FUNCTION process_stock_transfer()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_transfer_record RECORD;
BEGIN
  -- Get transfer details
  SELECT * INTO v_transfer_record FROM store_stock_transfers WHERE id = NEW.transfer_id;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- On dispatch: reduce stock from source
  IF v_transfer_record.status = 'in_transit' AND OLD.quantity_sent = 0 THEN
    -- Create outbound movement
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
      from_location_id,
      to_location_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'transfer_out',
      CURRENT_DATE,
      NEW.quantity_sent,
      NEW.unit_cost,
      NEW.total_value,
      v_item_record.current_stock,
      v_item_record.current_stock - NEW.quantity_sent,
      v_transfer_record.from_location_id,
      v_transfer_record.to_location_id,
      'transfer',
      NEW.transfer_id,
      v_transfer_record.transfer_number,
      'Stock transferred out',
      v_transfer_record.dispatched_by_id
    );
  END IF;
  
  -- On receipt: add stock to destination
  IF NEW.quantity_received > OLD.quantity_received THEN
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
      from_location_id,
      to_location_id,
      reference_type,
      reference_id,
      reference_number,
      notes,
      performed_by_id
    ) VALUES (
      generate_movement_number(),
      NEW.item_id,
      NEW.batch_id,
      'transfer_in',
      CURRENT_DATE,
      NEW.quantity_received - OLD.quantity_received,
      NEW.unit_cost,
      (NEW.quantity_received - OLD.quantity_received) * NEW.unit_cost,
      v_item_record.current_stock,
      v_item_record.current_stock + (NEW.quantity_received - OLD.quantity_received),
      v_transfer_record.from_location_id,
      v_transfer_record.to_location_id,
      'transfer',
      NEW.transfer_id,
      v_transfer_record.transfer_number,
      'Stock transferred in',
      v_transfer_record.received_by_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_transfer_trigger
  AFTER INSERT OR UPDATE ON store_transfer_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_transfer();

-- Function to process stock adjustment
CREATE OR REPLACE FUNCTION process_stock_adjustment()
RETURNS TRIGGER AS $$
DECLARE
  v_item_record RECORD;
  v_adjustment_record RECORD;
  v_movement_type movement_type;
BEGIN
  -- Only process if adjustment is approved
  SELECT * INTO v_adjustment_record 
  FROM store_stock_adjustments 
  WHERE id = NEW.adjustment_id AND status = 'approved';
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- Get item details
  SELECT * INTO v_item_record FROM store_items WHERE id = NEW.item_id;
  
  -- Determine movement type
  IF NEW.variance_quantity > 0 THEN
    v_movement_type := 'adjustment_plus';
  ELSE
    v_movement_type := 'adjustment_minus';
  END IF;
  
  -- Update item stock
  UPDATE store_items
  SET 
    current_stock = NEW.actual_quantity,
    updated_at = NOW()
  WHERE id = NEW.item_id;
  
  -- Update batch if applicable
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE store_item_batches
    SET remaining_quantity = NEW.actual_quantity
    WHERE id = NEW.batch_id;
  END IF;
  
  -- Create stock movement record
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
    NEW.item_id,
    NEW.batch_id,
    v_movement_type,
    CURRENT_DATE,
    ABS(NEW.variance_quantity),
    NEW.unit_cost,
    ABS(NEW.variance_value),
    NEW.system_quantity,
    NEW.actual_quantity,
    'adjustment',
    NEW.adjustment_id,
    v_adjustment_record.adjustment_number,
    'Stock adjustment - ' || v_adjustment_record.reason::TEXT,
    v_adjustment_record.approved_by_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_stock_adjustment_trigger
  AFTER INSERT OR UPDATE ON store_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_adjustment();

-- Function to update PO status based on received quantities
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_ordered DECIMAL;
  v_total_received DECIMAL;
  v_po_id UUID;
BEGIN
  v_po_id := NEW.po_id;
  
  -- Calculate totals
  SELECT 
    SUM(quantity_ordered),
    SUM(quantity_received)
  INTO v_total_ordered, v_total_received
  FROM store_po_items
  WHERE po_id = v_po_id;
  
  -- Update PO status
  UPDATE store_purchase_orders
  SET 
    status = CASE
      WHEN v_total_received = 0 THEN status
      WHEN v_total_received >= v_total_ordered THEN 'fully_received'::po_status
      ELSE 'partially_received'::po_status
    END,
    actual_delivery_date = CASE
      WHEN v_total_received >= v_total_ordered THEN CURRENT_DATE
      ELSE actual_delivery_date
    END,
    updated_at = NOW()
  WHERE id = v_po_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_po_status_trigger
  AFTER UPDATE OF quantity_received ON store_po_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status();

-- Function to update supplier performance on PO completion
CREATE OR REPLACE FUNCTION update_supplier_performance_on_po()
RETURNS TRIGGER AS $$
DECLARE
  v_on_time BOOLEAN;
  v_supplier_id UUID;
BEGIN
  IF NEW.status = 'fully_received' AND OLD.status != 'fully_received' THEN
    v_supplier_id := NEW.supplier_id;
    
    -- Check if delivery was on time
    v_on_time := NEW.actual_delivery_date <= NEW.expected_delivery_date;
    
    -- Update supplier metrics
    UPDATE store_suppliers
    SET 
      total_orders = total_orders + 1,
      total_purchase_value = total_purchase_value + NEW.total_amount,
      on_time_delivery_rate = (
        (on_time_delivery_rate * total_orders + CASE WHEN v_on_time THEN 100 ELSE 0 END) / 
        (total_orders + 1)
      ),
      last_order_date = NEW.po_date,
      updated_at = NOW()
    WHERE id = v_supplier_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_supplier_performance_trigger
  AFTER UPDATE OF status ON store_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_performance_on_po();

-- Function to calculate totals for GRN
CREATE OR REPLACE FUNCTION calculate_grn_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE store_grn
  SET 
    total_items = (SELECT COUNT(*) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    total_quantity = (SELECT SUM(quantity_accepted) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    total_value = (SELECT SUM(total_value) FROM store_grn_items WHERE grn_id = NEW.grn_id),
    updated_at = NOW()
  WHERE id = NEW.grn_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_grn_totals_trigger
  AFTER INSERT OR UPDATE ON store_grn_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_grn_totals();

-- Function to alert on low stock
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.reorder_level THEN
    -- You can implement notification logic here
    -- For now, we'll just log it
    RAISE NOTICE 'Low stock alert for item %: Current stock % is at or below reorder level %',
      NEW.name, NEW.current_stock, NEW.reorder_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_low_stock_trigger
  AFTER UPDATE OF current_stock ON store_items
  FOR EACH ROW
  WHEN (NEW.current_stock <= NEW.reorder_level)
  EXECUTE FUNCTION check_low_stock_alert();

-- Function to check expiring items
CREATE OR REPLACE FUNCTION check_expiring_items()
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  batch_number TEXT,
  expiry_date DATE,
  days_to_expiry INTEGER,
  remaining_quantity DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.name,
    sib.batch_number,
    sib.expiry_date,
    (sib.expiry_date - CURRENT_DATE)::INTEGER,
    sib.remaining_quantity
  FROM store_item_batches sib
  JOIN store_items si ON si.id = sib.item_id
  WHERE 
    sib.expiry_date IS NOT NULL
    AND sib.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND sib.remaining_quantity > 0
    AND NOT sib.is_expired
  ORDER BY sib.expiry_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get items below reorder level
CREATE OR REPLACE FUNCTION get_items_to_reorder()
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  category item_category,
  current_stock DECIMAL,
  reorder_level DECIMAL,
  reorder_quantity DECIMAL,
  preferred_supplier_id UUID,
  preferred_supplier_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    si.id,
    si.item_code,
    si.name,
    si.category,
    si.current_stock,
    si.reorder_level,
    si.reorder_quantity,
    sis.supplier_id,
    ss.name
  FROM store_items si
  LEFT JOIN store_item_suppliers sis ON sis.item_id = si.id AND sis.is_preferred = true
  LEFT JOIN store_suppliers ss ON ss.id = sis.supplier_id
  WHERE 
    si.current_stock <= si.reorder_level
    AND si.is_active = true
    AND NOT si.is_discontinued
  ORDER BY si.category, si.name;
END;
$$ LANGUAGE plpgsql;
