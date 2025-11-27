-- View for purchase order summary
CREATE OR REPLACE VIEW v_purchase_order_summary AS
SELECT 
  po.id,
  po.po_number,
  po.branch,
  s.name as supplier_name,
  s.supplier_code,
  po.status,
  po.total_amount,
  COUNT(poi.id) as total_items,
  u1.email as created_by_user,
  u2.email as approved_by_user,
  po.created_at,
  po.approved_at,
  po.received_at
FROM purchase_orders po
JOIN suppliers s ON po.supplier_id = s.id
LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
LEFT JOIN users u1 ON po.created_by = u1.id
LEFT JOIN users u2 ON po.approved_by = u2.id
GROUP BY 
  po.id,
  po.po_number,
  po.branch,
  s.name,
  s.supplier_code,
  po.status,
  po.total_amount,
  u1.email,
  u2.email,
  po.created_at,
  po.approved_at,
  po.received_at;

-- View for requisition summary
CREATE OR REPLACE VIEW v_requisition_summary AS
SELECT 
  r.id,
  r.requisition_number,
  r.department,
  r.branch,
  r.status,
  r.priority,
  COUNT(ri.id) as total_items,
  SUM(CASE WHEN ri.fulfilled_quantity >= ri.quantity THEN 1 ELSE 0 END) as fulfilled_items,
  u1.email as created_by_user,
  u2.email as approved_by_user,
  r.created_at,
  r.approved_at,
  r.fulfilled_at
FROM requisitions r
LEFT JOIN requisition_items ri ON r.id = ri.requisition_id
LEFT JOIN users u1 ON r.created_by = u1.id
LEFT JOIN users u2 ON r.approved_by = u2.id
GROUP BY 
  r.id,
  r.requisition_number,
  r.department,
  r.branch,
  r.status,
  r.priority,
  u1.email,
  u2.email,
  r.created_at,
  r.approved_at,
  r.fulfilled_at;

-- View for supplier performance
CREATE OR REPLACE VIEW v_supplier_performance AS
SELECT 
  s.id,
  s.supplier_code,
  s.name,
  COUNT(DISTINCT po.id) as total_orders,
  AVG(CASE WHEN po.status = 'received' 
      THEN EXTRACT(EPOCH FROM (po.received_at - po.approved_at))/86400.0 
      ELSE NULL END) as avg_delivery_days,
  SUM(CASE WHEN po.status = 'received' THEN po.total_amount ELSE 0 END) as total_received_amount,
  COUNT(CASE WHEN po.status = 'cancelled' THEN 1 END) as cancelled_orders
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id
WHERE s.status = 'active'
GROUP BY s.id, s.supplier_code, s.name;

-- View for inventory alerts
CREATE OR REPLACE VIEW v_inventory_alerts AS
SELECT 
  i.id,
  i.name,
  i.item_code,
  bi.branch,
  i.category,
  i.subcategory,
  bi.quantity as current_stock,
  i.reorder_point as reorder_level,
  i.unit,
  CASE 
    WHEN bi.quantity <= i.reorder_point THEN 'low_stock'
    ELSE 'normal'
  END as stock_status,
  COALESCE(po_qty.pending_quantity, 0) as pending_po_quantity,
  COALESCE(req_qty.pending_quantity, 0) as pending_requisition_quantity
FROM inventory_items i
JOIN branch_inventory bi ON i.id = bi.item_id
LEFT JOIN (
  SELECT 
    poi.item_id,
    po.branch,
    SUM(poi.quantity - poi.received_quantity) as pending_quantity
  FROM purchase_order_items poi
  JOIN purchase_orders po ON poi.po_id = po.id
  WHERE po.status IN ('approved', 'ordered')
  GROUP BY poi.item_id, po.branch
) po_qty ON i.id = po_qty.item_id AND bi.branch = po_qty.branch
LEFT JOIN (
  SELECT 
    ri.item_id,
    r.branch,
    SUM(ri.quantity - ri.fulfilled_quantity) as pending_quantity
  FROM requisition_items ri
  JOIN requisitions r ON ri.requisition_id = r.id
  WHERE r.status = 'approved'
  GROUP BY ri.item_id, r.branch
) req_qty ON i.id = req_qty.item_id AND bi.branch = req_qty.branch;
