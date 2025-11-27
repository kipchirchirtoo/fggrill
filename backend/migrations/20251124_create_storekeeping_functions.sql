-- Function to auto-generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  po_number TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(po_number FROM '\d+$')::INT), 0) + 1
  INTO counter
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year || month || '-%';
  
  po_number := 'PO-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate requisition number
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  req_number TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(requisition_number FROM '\d+$')::INT), 0) + 1
  INTO counter
  FROM requisitions
  WHERE requisition_number LIKE 'REQ-' || year || month || '-%';
  
  req_number := 'REQ-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN req_number;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update stock levels
DROP FUNCTION IF EXISTS check_stock_levels();
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS TABLE (
  item_id INTEGER,
  item_name TEXT,
  current_stock INT,
  reorder_level INT,
  branch TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    bi.quantity,
    i.reorder_point,
    bi.branch::TEXT
  FROM inventory_items i
  JOIN branch_inventory bi ON i.id = bi.item_id
  WHERE bi.quantity <= i.reorder_point;
END;
$$ LANGUAGE plpgsql;

-- Function to process purchase order approval
CREATE OR REPLACE FUNCTION process_purchase_order_approval(
  p_po_id UUID,
  p_approved_by UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update PO status
  UPDATE purchase_orders
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE id = p_po_id;

  -- Create notification
  INSERT INTO notifications (
    type,
    title,
    message,
    department,
    priority,
    action_url
  )
  SELECT
    'info',
    'Purchase Order Approved',
    'Purchase order ' || po_number || ' has been approved',
    'Store Keeping',
    'medium',
    '/dashboard/storekeeping/purchase-orders/' || id
  FROM purchase_orders
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process purchase order receiving
CREATE OR REPLACE FUNCTION process_purchase_order_receiving(
  p_po_id UUID,
  p_items JSON
)
RETURNS VOID AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- Update PO status
  UPDATE purchase_orders
  SET 
    status = 'received',
    received_at = NOW()
  WHERE id = p_po_id;

  -- Update received quantities
  FOR item_record IN SELECT * FROM json_array_elements(p_items)
  LOOP
    -- Update PO item
    UPDATE purchase_order_items
    SET received_quantity = (item_record.value->>'received_quantity')::INT
    WHERE id = (item_record.value->>'po_item_id')::UUID;

    -- Update inventory
    UPDATE branch_inventory
    SET quantity = quantity + (item_record.value->>'received_quantity')::INT
    WHERE item_id = (item_record.value->>'item_id')::INTEGER
    AND branch = (
      SELECT branch 
      FROM purchase_orders 
      WHERE id = p_po_id
    );
  END LOOP;

  -- Create notification
  INSERT INTO notifications (
    type,
    title,
    message,
    department,
    priority,
    action_url
  )
  SELECT
    'success',
    'Purchase Order Received',
    'Purchase order ' || po_number || ' has been received',
    'Store Keeping',
    'high',
    '/dashboard/storekeeping/purchase-orders/' || id
  FROM purchase_orders
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process requisition approval
CREATE OR REPLACE FUNCTION process_requisition_approval(
  p_requisition_id UUID,
  p_approved_by UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update requisition status
  UPDATE requisitions
  SET 
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE id = p_requisition_id;

  -- Create notification
  INSERT INTO notifications (
    type,
    title,
    message,
    department,
    priority,
    action_url
  )
  SELECT
    'info',
    'Requisition Approved',
    'Requisition ' || requisition_number || ' has been approved',
    department,
    'medium',
    '/dashboard/storekeeping/requisitions/' || id
  FROM requisitions
  WHERE id = p_requisition_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process requisition fulfillment
CREATE OR REPLACE FUNCTION process_requisition_fulfillment(
  p_requisition_id UUID,
  p_items JSON
)
RETURNS VOID AS $$
DECLARE
  item_record RECORD;
BEGIN
  -- Update requisition status
  UPDATE requisitions
  SET 
    status = 'fulfilled',
    fulfilled_at = NOW()
  WHERE id = p_requisition_id;

  -- Update fulfilled quantities and inventory
  FOR item_record IN SELECT * FROM json_array_elements(p_items)
  LOOP
    -- Update requisition item
    UPDATE requisition_items
    SET fulfilled_quantity = (item_record.value->>'fulfilled_quantity')::INT
    WHERE id = (item_record.value->>'requisition_item_id')::UUID;

    -- Update inventory
    UPDATE branch_inventory
    SET quantity = quantity - (item_record.value->>'fulfilled_quantity')::INT
    WHERE item_id = (item_record.value->>'item_id')::INTEGER
    AND branch = (
      SELECT branch 
      FROM requisitions 
      WHERE id = p_requisition_id
    );
  END LOOP;

  -- Create notification
  INSERT INTO notifications (
    type,
    title,
    message,
    department,
    priority,
    action_url
  )
  SELECT
    'success',
    'Requisition Fulfilled',
    'Requisition ' || requisition_number || ' has been fulfilled',
    department,
    'high',
    '/dashboard/storekeeping/requisitions/' || id
  FROM requisitions
  WHERE id = p_requisition_id;
END;
$$ LANGUAGE plpgsql;
