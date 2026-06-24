-- Consolidate all stock take records into one canonical pair: stock_counts / stock_count_items.
-- Adds a 'location' column to stock_counts so that bar, store, kitchen, and central
-- counts can all live in the same table. Backfills historical records from the
-- legacy stock take tables (stock_takes/stock_take_lines, central_stock_take_sessions,
-- bar_stocktake_records, store_stocktake_records, kitchen stock takes) so the cashier
-- shift opening gate can query a single table.

-- 1. Add location column to the canonical stock take header.
ALTER TABLE stock_counts
  ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Backfill stock_counts from the legacy stock_takes table.
-- We map stock_takes.store_type -> stock_counts.location and keep the same status.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  notes,
  total_variance_value,
  created_at,
  updated_at
)
SELECT
  t.id,
  t.branch_id,
  t.count_date,
  COALESCE(t.count_type, 'daily'),
  t.store_type,
  t.store_type,
  t.status,
  t.counted_by,
  t.notes,
  t.variance_value,
  t.created_at,
  t.updated_at
FROM stock_takes t
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = t.id
);

-- 3. Backfill stock_count_items from the legacy stock_take_lines table.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  unit_cost,
  variance_value,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  l.id,
  l.stock_take_id,
  l.item_id,
  l.item_sku,
  l.system_quantity,
  l.physical_quantity,
  l.counted_quantity,
  l.variance_quantity,
  COALESCE(l.unit_cost, l.cost_price),
  l.variance_value,
  COALESCE(l.variance_reason, l.notes),
  l.status,
  l.created_at,
  l.updated_at
FROM stock_take_lines l
WHERE NOT EXISTS (
  SELECT 1 FROM stock_count_items i WHERE i.id = l.id
);

-- 4. Backfill central stock takes (central_stock_take_sessions -> stock_counts).
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  submitted_to_accountant_by,
  submitted_to_accountant_at,
  notes,
  total_variance_value,
  created_at,
  updated_at
)
SELECT
  s.id,
  NULL, -- central sessions do not have a branch_id
  CURRENT_DATE,
  'daily',
  'central_store',
  'central_store',
  CASE
    WHEN s.status = 'approved' THEN 'approved'
    WHEN s.status = 'rejected' THEN 'rejected'
    WHEN s.status = 'completed' THEN 'submitted'
    ELSE 'draft'
  END,
  s.started_by,
  s.submitted_by,
  s.submitted_at,
  s.notes,
  s.total_variance_value,
  s.created_at,
  s.updated_at
FROM central_stock_take_sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = s.id
);

-- 5. Backfill central stock take items (central_stock_take_items -> stock_count_items).
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  unit_cost,
  variance_value,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  i.id,
  i.session_id,
  NULL,
  i.item_sku,
  i.system_quantity,
  i.counted_quantity,
  i.counted_quantity,
  i.variance,
  i.unit_cost,
  i.variance_value,
  COALESCE(i.variance_reason, i.notes),
  'draft',
  i.created_at,
  i.updated_at
FROM central_stock_take_items i
WHERE NOT EXISTS (
  SELECT 1 FROM stock_count_items ci WHERE ci.id = i.id
);

-- 6. Backfill bar stocktake records into stock_counts.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  accountant_reviewed_by,
  accountant_reviewed_at,
  notes,
  created_at,
  updated_at
)
SELECT
  r.id,
  r.branch_id,
  r.stocktake_date,
  'daily',
  'bar',
  r.bar_location,
  CASE
    WHEN r.status = 'approved' THEN 'approved'
    WHEN r.status = 'rejected' THEN 'rejected'
    WHEN r.status = 'submitted' THEN 'submitted'
    ELSE 'draft'
  END,
  r.recorded_by,
  r.reviewed_by,
  r.reviewed_at,
  r.notes,
  r.created_at,
  r.created_at
FROM bar_stocktake_records r
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = r.id
);

-- 7. Backfill bar stocktake line items into stock_count_items.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  r.id,
  r.item_id,
  NULL,
  r.system_quantity,
  r.physical_quantity,
  r.physical_quantity,
  r.variance,
  r.reason_for_variance,
  'draft',
  r.created_at,
  r.created_at
FROM bar_stocktake_records r
WHERE r.item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_count_items i WHERE i.stock_count_id = r.id AND i.item_id = r.item_id
  );

-- 8. Backfill store stocktake records into stock_counts.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  accountant_reviewed_by,
  accountant_reviewed_at,
  notes,
  created_at,
  updated_at
)
SELECT
  r.id,
  r.branch_id,
  r.stocktake_date,
  'daily',
  'branch_store',
  'branch_store',
  CASE
    WHEN r.status = 'approved' THEN 'approved'
    WHEN r.status = 'rejected' THEN 'rejected'
    WHEN r.status = 'submitted' THEN 'submitted'
    ELSE 'draft'
  END,
  r.recorded_by,
  r.reviewed_by,
  r.reviewed_at,
  r.notes,
  r.created_at,
  r.updated_at
FROM store_stocktake_records r
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = r.id
);

-- 9. Backfill store stocktake line items into stock_count_items.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  r.id,
  r.item_id,
  NULL,
  r.system_quantity,
  r.physical_quantity,
  r.physical_quantity,
  r.variance,
  r.notes,
  'draft',
  r.created_at,
  r.updated_at
FROM store_stocktake_records r
WHERE r.item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_count_items i WHERE i.stock_count_id = r.id AND i.item_id = r.item_id
  );

-- 10. Backfill kitchen shift stock take into stock_counts.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  notes,
  created_at,
  updated_at
)
SELECT
  r.id,
  r.branch_id,
  CURRENT_DATE,
  'daily',
  'kitchen',
  'kitchen',
  'draft',
  r.counted_by,
  r.variance_reason,
  r.created_at,
  r.updated_at
FROM kitchen_shift_stock_take r
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = r.id
);

-- 11. Backfill kitchen shift stock take items into stock_count_items.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  variance_value,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  r.id,
  NULL,
  r.item_sku,
  r.system_closing_stock,
  r.physical_count,
  r.physical_count,
  r.variance,
  r.variance_value,
  r.variance_reason,
  'draft',
  r.created_at,
  r.updated_at
FROM kitchen_shift_stock_take r
WHERE r.item_sku IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM stock_count_items i WHERE i.stock_count_id = r.id AND i.item_sku = r.item_sku
  );

-- 12. Backfill kitchen stocktake sessions (kitchen_stocktake_shifts) into stock_counts.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  submitted_to_accountant_by,
  submitted_to_accountant_at,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.branch_id,
  s.stocktake_date,
  'daily',
  'kitchen',
  'kitchen',
  CASE
    WHEN s.status = 'submitted' THEN 'submitted'
    WHEN s.status = 'approved' THEN 'approved'
    WHEN s.status = 'rejected' THEN 'rejected'
    ELSE 'draft'
  END,
  s.submitted_by,
  s.submitted_by,
  s.submitted_at,
  s.created_at,
  s.updated_at
FROM kitchen_stocktake_shifts s
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c WHERE c.id = s.id
);

-- 13. Backfill kitchen stocktake session items into stock_count_items.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  i.id,
  i.shift_id,
  NULL,
  NULL,
  i.opening_qty + i.added_qty,
  i.closing_qty,
  i.closing_qty,
  i.variance,
  NULL,
  'draft',
  i.created_at,
  i.updated_at
FROM kitchen_stocktake_items i
WHERE NOT EXISTS (
  SELECT 1 FROM stock_count_items ci WHERE ci.id = i.id
);

-- 14. Backfill POS outlet shift stock counts into stock_counts.
INSERT INTO stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  o.branch_id,
  CURRENT_DATE,
  'shift',
  'pos_outlet',
  o.name,
  'draft',
  NULL,
  r.created_at,
  r.updated_at
FROM pos_shift_stock_counts r
JOIN pos_outlets o ON o.id = r.outlet_id
WHERE NOT EXISTS (
  SELECT 1 FROM stock_counts c
  WHERE c.count_date = CURRENT_DATE
    AND c.store_type = 'pos_outlet'
    AND c.location = o.name
    AND c.branch_id = o.branch_id
)
GROUP BY o.branch_id, o.name, r.created_at, r.updated_at;

-- 15. Backfill POS outlet shift stock count line items into stock_count_items.
INSERT INTO stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  system_quantity,
  physical_quantity,
  counted_quantity,
  variance,
  variance_value,
  reason,
  status,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  c.id,
  r.outlet_item_id,
  r.sku,
  r.system_closing_stock,
  r.physical_count,
  r.physical_count,
  r.variance,
  NULL,
  r.variance_reason,
  'draft',
  r.created_at,
  r.updated_at
FROM pos_shift_stock_counts r
JOIN pos_outlets o ON o.id = r.outlet_id
JOIN stock_counts c ON c.count_date = CURRENT_DATE
  AND c.store_type = 'pos_outlet'
  AND c.location = o.name
  AND c.branch_id = o.branch_id
WHERE NOT EXISTS (
  SELECT 1 FROM stock_count_items i
  WHERE i.stock_count_id = c.id AND i.item_sku = r.sku
);

-- 16. Ensure an index exists for the shift gate query.
CREATE INDEX IF NOT EXISTS idx_stock_counts_branch_date_location
  ON stock_counts(branch_id, count_date, location);
