-- Realign kitchen stock counts backfill.
-- Deletes the bad backfill rows from step 10 & 11 in 20260624_unified_stock_take_workflow.sql
-- (which backfilled each kitchen_shift_stock_take row as a draft stock_counts header,
-- resulting in cashier shift gates blocking because they are draft).
-- Then, properly backfills stock_counts / stock_count_items from kitchen_shifts and kitchen_shift_stock_take.

-- 1. Delete previously backfilled stock_counts from kitchen_shift_stock_take
DELETE FROM public.stock_counts
WHERE store_type = 'kitchen' AND location = 'kitchen' AND status = 'draft';

-- 2. Delete item rows associated with those deleted counts
-- (Note: ON DELETE CASCADE will handle this, but to be safe and clean, let's run it)
DELETE FROM public.stock_count_items
WHERE stock_count_id NOT IN (SELECT id FROM public.stock_counts) AND item_sku IS NOT NULL;

-- 3. Proper backfill of kitchen_shifts into stock_counts
INSERT INTO public.stock_counts (
  id,
  branch_id,
  count_date,
  count_type,
  store_type,
  location,
  status,
  counted_by,
  approved_by,
  approved_at,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.branch_id,
  s.shift_date,
  'daily',
  'kitchen',
  'kitchen_' || lower(s.shift_type),
  CASE
    WHEN s.status = 'closed' THEN 'draft'
    WHEN s.status IN ('pending_chef_confirmation', 'pending_accountant_review') THEN 'submitted'
    WHEN s.status = 'approved' THEN 'approved'
    WHEN s.status = 'rejected' THEN 'rejected'
    ELSE 'draft'
  END,
  COALESCE(s.store_keeper_id, s.opened_by),
  s.accountant_approved_by,
  s.accountant_approved_at,
  s.opened_at,
  s.updated_at
FROM public.kitchen_shifts s
WHERE s.status <> 'open'
  AND EXISTS (
    SELECT 1 FROM public.kitchen_shift_stock_take r WHERE r.shift_id = s.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_counts c WHERE c.id = s.id
  );

-- 4. Proper backfill of items from kitchen_shift_stock_take into stock_count_items
INSERT INTO public.stock_count_items (
  id,
  stock_count_id,
  item_id,
  item_sku,
  item_name,
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
  r.shift_id,
  i.id, -- matched inventory_items.id
  r.item_sku,
  r.item_name,
  r.system_closing_stock,
  r.physical_count,
  r.physical_count,
  r.variance,
  r.variance_value,
  r.variance_reason,
  CASE
    WHEN s.status = 'closed' THEN 'draft'
    WHEN s.status IN ('pending_chef_confirmation', 'pending_accountant_review') THEN 'submitted'
    WHEN s.status = 'approved' THEN 'approved'
    WHEN s.status = 'rejected' THEN 'rejected'
    ELSE 'draft'
  END,
  r.created_at,
  r.updated_at
FROM public.kitchen_shift_stock_take r
JOIN public.kitchen_shifts s ON s.id = r.shift_id
LEFT JOIN public.inventory_items i ON i.sku = r.item_sku
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_count_items ci 
  WHERE ci.stock_count_id = r.shift_id AND ci.item_sku = r.item_sku
);
