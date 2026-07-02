# Famous Gates Hotels - Inventory Mapping
Generated 2026-07-01. Read-only live database audit.

## 1. Three-Layer Inventory Architecture

`
LAYER 1 - CENTRAL INVENTORY (Master Catalog)
  inventory_items / simple_items (832 rows each - same data)
  SKU format: FG-xxx (e.g. FG-3 = EXE ALL PURPOSE FLOUR)
  Stores: standard cost, unit, category, reorder level

LAYER 2 - BRANCH STOCK (Per-Branch Balance)
  branch_stock (1,155 rows)
  Tracks: quantity, reorder_level, max_stock_level, unit_cost
  Updated by: branch_stock_movements

LAYER 3 - BAR STOCK (Per-Drink Balance)
  bar_stock (255 rows)
  Tracks: current_stock per drink per branch
  Updated by: bar_stock_ledger (sale/restock/reversal)
`

## 2. simple_items vs inventory_items

simple_items IS A VIEW of inventory_items. Both have 832 rows.
Both contain the same FG-xxx SKU items.
Use inventory_items for JOIN to recipe_items (item_sku) and bar_stocktake_records (item_id=UUID).
Use simple_items for branch_stock JOINs (item_sku column).

## 3. Branch Stock Movements - All Types

| Movement Type | Count | Effect | Trigger |
|--------------|-------|--------|---------|
| DISPATCH_OUT | 353 | Central store decrements | Dispatch note confirmed |
| DISPATCH_RECEIVE | 232 | Branch stock increments | Branch confirms receipt |
| INITIAL_STOCK | 103 | Opening stock seeding | One-time setup |
| KITCHEN_SHIFT_ADD_STOCK | 43 | Kitchen received stock | Kitchen shift addition |
| KITCHEN_SHIFT_OPEN | 14 | Kitchen shift opening | Shift opening record |
| PASTRY_PRODUCTION | 8 | Pastry items produced | Production completion |
| PASTRY_ISSUE_TO_KITCHEN | 5 | Pastry issued to kitchen | Kitchen request |
| MANUAL_ADJUSTMENT | 1 | Manual correction | Admin override |

## 4. Bar Stock Control Chain

`
bar_drinks (catalog)
  branch_id + name + unit + cost_price + selling_price + inventory_item_id
    |
    |-- bar_stock (live balance)
    |   drink_id + current_stock + par_level
    |
    |-- bar_stock_ledger (movement log)
    |   drink_id + transaction_type + quantity + opening_balance + closing_balance
    |   Types: sale (1661) | sale_reversal (122) | restock (49)
    |
    |-- bar_stocktake_records (daily physical count)
        item_id (FK inventory_items) + stocktake_date + bar_location
        opening_stock + additions + sales + system_quantity
        physical_quantity + variance + reason_for_variance
        status: pending -> reviewed -> approved/rejected
`

## 5. Branch Requisition Chain

`
stock_requests (branch requests)
  branch_id + status + workflow_status + request_type
    |
    |-- stock_request_items (line items)
    |   item_sku + requested_quantity + approved_quantity + packed_quantity
    |   received_quantity + status
    |
    |-- dispatch_notes (central store ships)
    |   from_branch_id + to_branch_id + status + dispatched_at
    |
    |-- branch_stock_movements (DISPATCH_RECEIVE)
        item_sku + quantity + new_stock + reference_id=dispatch_note.id
`

### Current Requisition Status

| Status | Workflow | Count |
|--------|---------|-------|
| DELIVERED | received | 8 |
| APPROVED | branch_accountant_approved | 2 |
| DISPATCHED | in_transit | 2 |
| REJECTED | branch_accountant_rejected | 2 |

## 6. POS Outlet Item Linkage (Stock Connection)

For a POS sale to deduct stock, pos_outlet_items needs:
- source_table = 'bar_drinks' or 'restaurant_menu_items'
- source_item_id = UUID of stock item

| Branch | Outlet | Total | Linked | Unlinked | Source | Issue |
|--------|--------|-------|--------|----------|--------|-------|
| 2 | main_bar | 118 | 117 | 1 | bar_drinks | 1 manual |
| 2 | non_consm | 3 | 3 | 0 | bar_drinks | OK |
| 2 | restaurant | 162 | 153 | 9 | restaurant_menu_items | 9 unlinked |
| 4 | main_bar | 139 | 139 | 0 | bar_drinks | OK |
| 5 | main_bar | 138 | 138 | 0 | restaurant_menu_items | WRONG TABLE |
| 5 | restaurant | 187 | 187 | 0 | restaurant_menu_items | OK |
| Others | all | 0 | 0 | 0 | — | NOT SEEDED |

## 7. Reorder Levels and Stock Standards

### branch_stock
| Column | Default | Notes |
|--------|---------|-------|
| reorder_level | 10 | System default - NOT customised per item |
| max_stock_level | 100 | System default - NOT customised per item |
| minimum_stock | NULL | Not populated |

### bar_stock
| Column | Default | Notes |
|--------|---------|-------|
| par_level | 0 | NOT configured - low-stock alerts will not trigger |
| low_stock | false | Computed from par_level comparison |

### inventory_items
| Column | Notes |
|--------|-------|
| reorder_level | Set to 0 for most items |
| default_unit_cost | Zero for KITCHEN MENU category items |

## 8. Inventory Seeding Status by Branch

| Branch | bar_drinks | bar_stock | pos_outlet_items | branch_stock | recipes |
|--------|-----------|-----------|-----------------|-------------|---------|
| 1 Kyogong | 0 | 0 | 0 | partial | 0 |
| 2 Bomet | 117 | 117 | 283 | yes | 13 |
| 3 Kaplong | 0 | 0 | 0 | partial | 0 |
| 4 Sotik | 139 | 139 | 139 | yes | 0 |
| 5 Mogo | 0 | 0 | 325 (anomaly) | partial | 0 |
| 6 Kaptote | 0 | 0 | 0 | partial | 0 |
| 7 Litein | 0 | 0 | 0 | partial | 0 |
| 8 Kapsoit | 0 | 0 | 0 | partial | 0 |
| 9 Grill | 0 | 0 | 0 | partial | 0 |
| 10 Guesthouse | 0 | 0 | 0 | partial | 0 |

## 9. Inventory Item Categories Found

| Category | Description | Used For |
|----------|-------------|---------|
| RAW MATERIALS | FG-xxx items (flour, meat, vegetables) | Recipes, kitchen |
| BAR DRINKS | Bar catalog items | Bar stock (via bar_drinks) |
| KITCHEN MENU | Portion-level finished goods | Kitchen stocktake |
| CLEANING | Cleaning supplies | Branch store |
| STATIONERY | Office supplies | Branch store |

## 10. SQL: Check Branch Stock Levels

`sql
SELECT
    bs.branch_id,
    b.name AS branch,
    bs.item_sku,
    ii.item_name,
    ii.unit,
    bs.quantity AS current_qty,
    bs.reorder_level,
    bs.max_stock_level,
    CASE WHEN bs.quantity <= bs.reorder_level THEN 'LOW STOCK' ELSE 'OK' END AS stock_status,
    ii.default_unit_cost,
    bs.quantity * ii.default_unit_cost AS stock_value
FROM branch_stock bs
JOIN inventory_items ii ON ii.sku = bs.item_sku
JOIN branches b ON b.id = bs.branch_id
WHERE ii.is_active = true
ORDER BY bs.branch_id, stock_status DESC, ii.item_name;
`

## 11. SQL: Bar Stock Balance

`sql
SELECT
    bs.branch_id,
    b.name AS branch,
    bd.name AS drink,
    bd.unit,
    bs.current_stock,
    bs.par_level,
    bd.cost_price,
    bs.current_stock * bd.cost_price AS stock_value,
    CASE WHEN bs.par_level > 0 AND bs.current_stock <= bs.par_level THEN 'LOW' ELSE 'OK' END AS level
FROM bar_stock bs
JOIN bar_drinks bd ON bd.id = bs.drink_id
JOIN branches b ON b.id = bs.branch_id
WHERE bd.is_active = true
ORDER BY bs.branch_id, bd.name;
`

End of inventory_mapping.md
