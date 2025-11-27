-- Bridge views so storekeeping controllers can use unified base tables

-- View: store_suppliers maps to suppliers
CREATE OR REPLACE VIEW store_suppliers AS
SELECT 
  s.id,
  COALESCE(s.supplier_code, 'SUP:' || LPAD(s.id::text, 4, '0')) AS supplier_code,
  s.name,
  NULL::text AS description,
  s.email,
  s.phone,
  s.address,
  NULL::text AS city,
  NULL::text AS country,
  CASE 
    WHEN s.payment_terms = 'immediate' THEN 'cash'
    WHEN s.payment_terms = 'net_7' THEN 'credit_7_days'
    WHEN s.payment_terms = 'net_15' THEN 'credit_14_days'
    WHEN s.payment_terms = 'net_30' THEN 'credit_30_days'
    WHEN s.payment_terms = 'net_45' THEN 'credit_60_days'
    WHEN s.payment_terms = 'net_60' THEN 'credit_90_days'
    ELSE 'credit_30_days'
  END::text AS payment_terms,
  s.credit_limit,
  false AS is_preferred,
  s.status::text AS status,
  s.created_at,
  s.updated_at
FROM suppliers s;

-- View: store_items maps to inventory_items + aggregated stock
CREATE OR REPLACE VIEW store_items AS
SELECT 
  i.id,
  i.item_code,
  i.name,
  i.description,
  i.category::text AS category,
  i.unit,
  COALESCE(SUM(bi.quantity), 0) AS current_stock,
  i.minimum_stock,
  i.maximum_stock,
  i.reorder_point AS reorder_level,
  0 AS reorder_quantity,
  i.unit_cost,
  i.is_active,
  false AS is_perishable,
  NULL::integer AS shelf_life_days,
  false AS track_batch_number,
  false AS track_serial_number,
  i.has_expiry AS track_expiry,
  NULL::text AS barcode,
  NULL::uuid AS storage_location_id,
  'weighted_average'::text AS costing_method,
  i.created_at,
  i.updated_at
FROM inventory_items i
LEFT JOIN branch_inventory bi ON bi.item_id = i.id
GROUP BY i.id, i.item_code, i.name, i.description, i.category, i.unit,
         i.minimum_stock, i.maximum_stock, i.reorder_point, i.unit_cost,
         i.is_active, i.has_expiry, i.created_at, i.updated_at;
