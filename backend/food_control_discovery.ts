require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function q(sql: string, params: any[] = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function main() {
  const out: Record<string, any> = {};

  // ── 1. All tables ────────────────────────────────────────────────────────
  out.tables = await q(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  // ── 2. All columns with types, nullability, defaults ────────────────────
  out.columns = await q(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.character_maximum_length,
      c.is_nullable,
      c.column_default,
      c.ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  // ── 3. Primary keys ──────────────────────────────────────────────────────
  out.primary_keys = await q(`
    SELECT
      tc.table_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position
  `);

  // ── 4. Foreign keys ──────────────────────────────────────────────────────
  out.foreign_keys = await q(`
    SELECT
      tc.table_name AS from_table,
      kcu.column_name AS from_column,
      ccu.table_name AS to_table,
      ccu.column_name AS to_column,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name
  `);

  // ── 5. Unique constraints ────────────────────────────────────────────────
  out.unique_constraints = await q(`
    SELECT
      tc.table_name,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
    GROUP BY tc.table_name, tc.constraint_name
    ORDER BY tc.table_name
  `);

  // ── 6. Indexes ───────────────────────────────────────────────────────────
  out.indexes = await q(`
    SELECT
      tablename AS table_name,
      indexname AS index_name,
      indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  // ── 7. Row counts for key tables ─────────────────────────────────────────
  const keyTables = [
    'pos_shift_orders','pos_outlet_items','pos_outlets','pos_outlet_assignments',
    'restaurant_orders','restaurant_order_items','restaurant_menu_items','restaurant_menu_categories',
    'bar_drinks','bar_stock','bar_stock_ledger','bar_stocktake_records',
    'kitchen_stocktake_shifts','kitchen_stocktake_items',
    'simple_items','inventory_items','branch_stock','branch_stock_movements',
    'stock_requests','stock_request_items','dispatch_notes','dispatch_note_items',
    'kitchen_shifts','kitchen_items','kitchen_stock_movements',
    'spoilage_records','food_control_config','branch_food_control_configs',
    'waiter_sales','waiter_sale_items',
    'shifts','cashier_clearances','cashier_clearance_items',
    'suppliers','purchase_orders','purchase_order_items','goods_received_notes','grn_items',
    'recipe_items','recipes','menu_pricing',
    'branches','staff','pos_shift_sessions',
    'kitchen_usage_logs','kitchen_wastage_records','kitchen_wastage_items',
    'food_variance_reports','food_variance_items',
    'outlet_production_records','outlet_production_items',
    'bar_restock_requests','bar_restock_request_items',
  ];

  const counts: Record<string, number> = {};
  for (const t of keyTables) {
    try {
      const r = await q(`SELECT COUNT(*)::int AS n FROM public."${t}"`);
      counts[t] = r[0]?.n ?? 0;
    } catch {
      counts[t] = -1; // table doesn't exist
    }
  }
  out.row_counts = counts;

  // ── 8. POS shift orders sample ───────────────────────────────────────────
  out.pos_shift_orders_sample = await q(`
    SELECT id, shift_id, outlet_id, status, payment_status, total_amount,
           discount_amount, tax_amount, created_at,
           jsonb_array_length(COALESCE(items,'[]'::jsonb)) AS item_count
    FROM pos_shift_orders
    ORDER BY created_at DESC LIMIT 5
  `).catch(() => []);

  // ── 9. pos_shift_orders items JSONB structure ────────────────────────────
  out.pos_order_item_keys = await q(`
    SELECT DISTINCT jsonb_object_keys(elem) AS key
    FROM pos_shift_orders, jsonb_array_elements(COALESCE(items,'[]'::jsonb)) AS elem
    LIMIT 100
  `).catch(() => []);

  // ── 10. Kitchen stocktake items sample ───────────────────────────────────
  out.kitchen_stocktake_items_sample = await q(`
    SELECT ksi.*, kss.branch_id, kss.stocktake_date, kss.shift
    FROM kitchen_stocktake_items ksi
    JOIN kitchen_stocktake_shifts kss ON kss.id = ksi.shift_id
    ORDER BY kss.stocktake_date DESC, ksi.item_name
    LIMIT 10
  `).catch(() => []);

  // ── 11. Bar stock ledger transaction types ────────────────────────────────
  out.bar_stock_ledger_types = await q(`
    SELECT transaction_type, COUNT(*) AS cnt
    FROM bar_stock_ledger GROUP BY transaction_type ORDER BY cnt DESC
  `).catch(() => []);

  // ── 12. branch_stock_movements types ─────────────────────────────────────
  out.branch_stock_movement_types = await q(`
    SELECT movement_type, COUNT(*) AS cnt
    FROM branch_stock_movements GROUP BY movement_type ORDER BY cnt DESC
  `).catch(() => []);

  // ── 13. stock_request statuses ────────────────────────────────────────────
  out.stock_request_statuses = await q(`
    SELECT status, workflow_status, request_type, COUNT(*) AS cnt
    FROM stock_requests GROUP BY status, workflow_status, request_type ORDER BY cnt DESC
  `).catch(() => []);

  // ── 14. Recipes / recipe_items ─────────────────────────────────────────
  out.recipes_sample = await q(`
    SELECT * FROM recipes LIMIT 10
  `).catch(() => []);

  out.recipe_items_sample = await q(`
    SELECT * FROM recipe_items LIMIT 20
  `).catch(() => []);

  // ── 15. Menu items without recipes ────────────────────────────────────────
  out.menu_items_without_recipes = await q(`
    SELECT rmi.id, rmi.name, rmi.price, rmi.branch_id
    FROM restaurant_menu_items rmi
    WHERE NOT EXISTS (
      SELECT 1 FROM recipe_items ri WHERE ri.menu_item_id = rmi.id
    )
    AND rmi.is_available = true
    ORDER BY rmi.name
    LIMIT 30
  `).catch(() => []);

  // ── 16. pos_outlet_items not linked to source ─────────────────────────────
  out.pos_items_unlinked = await q(`
    SELECT poi.id, poi.name, poi.sku, poi.outlet_id, poi.source_table, poi.source_item_id,
           po.outlet_type, po.branch_id
    FROM pos_outlet_items poi
    JOIN pos_outlets po ON po.id = poi.outlet_id
    WHERE (poi.source_item_id IS NULL OR poi.source_table = 'manual')
      AND poi.is_active = true
      AND po.outlet_type IN ('restaurant','main_bar','executive_bar','choma_zone')
    ORDER BY po.branch_id, po.outlet_type, poi.name
    LIMIT 50
  `).catch(() => []);

  // ── 17. Inventory items with zero cost ────────────────────────────────────
  out.zero_cost_inventory = await q(`
    SELECT id, item_name, sku, category, unit, default_unit_cost
    FROM inventory_items
    WHERE (default_unit_cost IS NULL OR default_unit_cost = 0) AND is_active = true
    ORDER BY item_name LIMIT 30
  `).catch(() => []);

  // ── 18. simple_items with zero cost ──────────────────────────────────────
  out.zero_cost_simple = await q(`
    SELECT sku, item_name, category, unit, default_unit_cost, quantity
    FROM simple_items
    WHERE (default_unit_cost IS NULL OR default_unit_cost = 0)
    ORDER BY item_name LIMIT 30
  `).catch(() => []);

  // ── 19. Negative bar_stock ────────────────────────────────────────────────
  out.negative_bar_stock = await q(`
    SELECT bs.id, bs.branch_id, bs.drink_id, bs.current_stock, bd.name, bd.unit
    FROM bar_stock bs
    JOIN bar_drinks bd ON bd.id = bs.drink_id
    WHERE bs.current_stock < 0
    ORDER BY bs.current_stock ASC LIMIT 20
  `).catch(() => []);

  // ── 20. Negative branch_stock ─────────────────────────────────────────────
  out.negative_branch_stock = await q(`
    SELECT bsk.id, bsk.branch_id, bsk.item_sku, bsk.quantity, si.item_name, si.unit
    FROM branch_stock bsk
    LEFT JOIN simple_items si ON si.sku = bsk.item_sku
    WHERE bsk.quantity < 0
    ORDER BY bsk.quantity ASC LIMIT 20
  `).catch(() => []);

  // ── 21. Food control config ────────────────────────────────────────────────
  out.food_control_config = await q(`SELECT * FROM food_control_config LIMIT 20`).catch(() => []);
  out.branch_food_control = await q(`SELECT * FROM branch_food_control_configs LIMIT 20`).catch(() => []);

  // ── 22. Wastage / spoilage types ─────────────────────────────────────────
  out.spoilage_types = await q(`
    SELECT reason, COUNT(*) FROM spoilage_records GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 10
  `).catch(() => []);
  out.kitchen_wastage_types = await q(`
    SELECT reason, COUNT(*) FROM kitchen_wastage_records GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 10
  `).catch(() => []);

  // ── 23. Outlet production ─────────────────────────────────────────────────
  out.outlet_production_sample = await q(`
    SELECT * FROM outlet_production_records ORDER BY created_at DESC LIMIT 5
  `).catch(() => []);

  // ── 24. Branches ──────────────────────────────────────────────────────────
  out.branches = await q(`SELECT id, name, code, is_active FROM branches ORDER BY id`).catch(() => []);

  // ── 25. POS outlets ───────────────────────────────────────────────────────
  out.pos_outlets = await q(`
    SELECT id, branch_id, name, outlet_type, is_active FROM pos_outlets ORDER BY branch_id, outlet_type
  `).catch(() => []);

  // ── 26. Food sales by outlet (last 30 days) ──────────────────────────────
  out.food_sales_by_outlet = await q(`
    SELECT
      po.branch_id,
      po.outlet_type,
      COUNT(DISTINCT pso.id) AS order_count,
      SUM((pso.total_amount)::numeric) AS total_sales,
      SUM((pso.discount_amount)::numeric) AS total_discounts,
      MIN(pso.created_at) AS earliest,
      MAX(pso.created_at) AS latest
    FROM pos_shift_orders pso
    JOIN pos_outlets po ON po.id = pso.outlet_id
    WHERE pso.payment_status NOT IN ('voided','cancelled')
      AND pso.created_at >= NOW() - INTERVAL '30 days'
      AND po.outlet_type IN ('restaurant','main_bar','executive_bar','choma_zone','cashier')
    GROUP BY po.branch_id, po.outlet_type
    ORDER BY po.branch_id, po.outlet_type
  `).catch(() => []);

  // ── 27. Voided orders count ────────────────────────────────────────────────
  out.void_status_counts = await q(`
    SELECT payment_status, status, COUNT(*) AS cnt
    FROM pos_shift_orders
    GROUP BY payment_status, status
    ORDER BY cnt DESC
    LIMIT 20
  `).catch(() => []);

  // ── 28. Kitchen stocktake catalog items (unique) ──────────────────────────
  out.kitchen_stocktake_catalog = await q(`
    SELECT DISTINCT item_name, unit
    FROM kitchen_stocktake_items
    ORDER BY item_name
  `).catch(() => []);

  // ── 29. bar_drinks linked vs unlinked ─────────────────────────────────────
  out.bar_drinks_link_status = await q(`
    SELECT
      branch_id,
      COUNT(*) AS total_drinks,
      COUNT(inventory_item_id) AS linked_to_inventory,
      COUNT(*) - COUNT(inventory_item_id) AS unlinked
    FROM bar_drinks
    WHERE is_active = true
    GROUP BY branch_id
    ORDER BY branch_id
  `).catch(() => []);

  // ── 30. pos_outlet_items link status by outlet type ───────────────────────
  out.pos_outlet_link_status = await q(`
    SELECT
      po.branch_id,
      po.outlet_type,
      COUNT(*) AS total_items,
      COUNT(poi.source_item_id) AS linked,
      COUNT(*) - COUNT(poi.source_item_id) AS unlinked,
      COUNT(CASE WHEN poi.source_table = 'bar_drinks' THEN 1 END) AS bar_links,
      COUNT(CASE WHEN poi.source_table = 'restaurant_menu_items' THEN 1 END) AS menu_links,
      COUNT(CASE WHEN poi.source_table = 'manual' OR poi.source_table IS NULL THEN 1 END) AS manual
    FROM pos_outlet_items poi
    JOIN pos_outlets po ON po.id = poi.outlet_id
    WHERE poi.is_active = true
    GROUP BY po.branch_id, po.outlet_type
    ORDER BY po.branch_id, po.outlet_type
  `).catch(() => []);

  // ── 31. waiter_sales structure ────────────────────────────────────────────
  out.waiter_sales_sample = await q(`
    SELECT * FROM waiter_sales ORDER BY created_at DESC LIMIT 3
  `).catch(() => []);
  out.waiter_sale_items_sample = await q(`
    SELECT * FROM waiter_sale_items LIMIT 10
  `).catch(() => []);

  // ── 32. cashier_clearances ────────────────────────────────────────────────
  out.cashier_clearances_sample = await q(`
    SELECT id, shift_id, outlet_id, cashier_id, total_sales, total_cash,
           total_mpesa, total_card, status, created_at
    FROM cashier_clearances ORDER BY created_at DESC LIMIT 5
  `).catch(() => []);

  // ── 33. Kitchen usage / trackable items ───────────────────────────────────
  out.kitchen_usage_sample = await q(`
    SELECT * FROM kitchen_usage_logs ORDER BY created_at DESC LIMIT 10
  `).catch(() => []);

  // ── 34. food_variance_reports ─────────────────────────────────────────────
  out.food_variance_reports = await q(`
    SELECT * FROM food_variance_reports ORDER BY report_date DESC LIMIT 5
  `).catch(() => []);

  // ── 35. Shifts / sessions ─────────────────────────────────────────────────
  out.shifts_sample = await q(`
    SELECT id, branch_id, outlet_id, cashier_id, status, opened_at, closed_at
    FROM shifts ORDER BY opened_at DESC LIMIT 5
  `).catch(() => []);

  // ── 36. Suppliers ──────────────────────────────────────────────────────────
  out.suppliers_count = await q(`SELECT COUNT(*) AS n FROM suppliers`).catch(() => [{ n: 0 }]);

  // ── 37. GRN / Purchase orders ─────────────────────────────────────────────
  out.grn_sample = await q(`
    SELECT id, branch_id, supplier_id, status, total_amount, received_date
    FROM goods_received_notes ORDER BY received_date DESC LIMIT 5
  `).catch(() => []);

  // ── 38. branch_stock movements summary ────────────────────────────────────
  out.branch_stock_movements_summary = await q(`
    SELECT branch_id, movement_type, COUNT(*) AS cnt,
           SUM(quantity) AS total_qty
    FROM branch_stock_movements
    GROUP BY branch_id, movement_type
    ORDER BY branch_id, movement_type
  `).catch(() => []);

  // ── 39. bar_stocktake_records last 5 ─────────────────────────────────────
  out.bar_stocktake_recent = await q(`
    SELECT bsr.id, bsr.branch_id, bsr.bar_location, bsr.stocktake_date,
           bsr.status, bsr.physical_quantity, bsr.system_quantity,
           bsr.variance, bsr.reason_for_variance,
           ii.item_name
    FROM bar_stocktake_records bsr
    LEFT JOIN inventory_items ii ON ii.id = bsr.item_id
    ORDER BY bsr.stocktake_date DESC, bsr.created_at DESC
    LIMIT 15
  `).catch(() => []);

  // ── 40. Enums / check constraints ─────────────────────────────────────────
  out.check_constraints = await q(`
    SELECT conrelid::regclass AS table_name,
           conname AS constraint_name,
           pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid::regclass::text NOT LIKE 'pg_%'
    ORDER BY table_name
    LIMIT 100
  `).catch(() => []);

  fs.writeFileSync('food_control_discovery_result.json', JSON.stringify(out, null, 2));
  console.log('=== DISCOVERY COMPLETE ===');
  console.log(`Tables found: ${out.tables.length}`);
  console.log(`Columns found: ${out.columns.length}`);
  console.log(`Foreign keys: ${out.foreign_keys.length}`);
  console.log('\n=== ROW COUNTS ===');
  for (const [t, n] of Object.entries(out.row_counts as Record<string,number>)) {
    if (n !== -1) console.log(`  ${t}: ${n}`);
  }
  console.log('\n=== BRANCHES ===');
  console.log(JSON.stringify(out.branches, null, 2));
  console.log('\n=== POS OUTLETS ===');
  console.log(JSON.stringify(out.pos_outlets, null, 2));
  console.log('\n=== BAR DRINKS LINK STATUS ===');
  console.log(JSON.stringify(out.bar_drinks_link_status, null, 2));
  console.log('\n=== POS OUTLET ITEM LINK STATUS ===');
  console.log(JSON.stringify(out.pos_outlet_link_status, null, 2));
  console.log('\n=== FOOD SALES BY OUTLET (last 30d) ===');
  console.log(JSON.stringify(out.food_sales_by_outlet, null, 2));
  console.log('\n=== VOID STATUS COUNTS ===');
  console.log(JSON.stringify(out.void_status_counts, null, 2));
  console.log('\n=== BAR STOCK LEDGER TYPES ===');
  console.log(JSON.stringify(out.bar_stock_ledger_types, null, 2));
  console.log('\n=== STOCK REQUEST STATUSES ===');
  console.log(JSON.stringify(out.stock_request_statuses, null, 2));
  console.log('\n=== KITCHEN STOCKTAKE CATALOG ===');
  console.log(JSON.stringify(out.kitchen_stocktake_catalog, null, 2));
  console.log('\n=== NEGATIVE STOCK ===');
  console.log('Bar:', JSON.stringify(out.negative_bar_stock, null, 2));
  console.log('Branch:', JSON.stringify(out.negative_branch_stock, null, 2));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
