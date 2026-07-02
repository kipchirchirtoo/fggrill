# Famous Gates Hotels — Database Structure Report
*Read-only live database audit. Generated 2026-07-01.*

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total tables | 427 |
| Food-control related tables | 186 |
| Active branches | 10 |
| POS outlets configured | 45 |
| Total POS orders (all time) | 4,195 |
| Paid orders | 3,629 (86.5%) |
| Voided orders | 273 (6.5%) |
| Credit-bill orders | 257 (6.1%) |
| Open/unpaid orders | 35 (0.8%) |
| Bar drinks in catalog | 256 |
| Bar stock ledger entries | 1,832 |
| Restaurant menu items | 482 |
| Inventory / simple items | 832 |
| Branch stock records | 1,155 |
| Recipes (all branches) | 13 |
| Recipe ingredient lines | 16 |

**Critical discovery:** All POS sales flow through `pos_shift_orders` with a JSONB `items` array.
The tables `restaurant_orders` and `restaurant_order_items` are completely empty (0 rows each) — they are dead/legacy tables.

---

## 2. Branches

| ID | Name | Code | Status |
|----|------|------|--------|
| 1 | Kyogong | KYO | Active |
| 2 | BOMET TOWN | BTN | Active |
| 3 | KAPLONG | KPL | Active |
| 4 | SOTIK | STK | Active |
| 5 | MOGOGOSHIEK | MOG | Active |
| 6 | KAPTOTE | KPT | Active |
| 7 | LITEIN | LIT | Active |
| 8 | KAPSOIT | KST | Active |
| 9 | GRILL | GRL | Active |
| 10 | GUESTHOUSE | GHS | Active |

---

## 3. POS Outlets (45 total — all branches)

| Branch | Branch Name | Outlet Type | Has POS Items? |
|--------|------------|-------------|----------------|
| 1 | Kyogong | cashier (x2), choma_zone, executive_bar, main_bar, other, restaurant, spa, sports_bar | NO |
| 2 | Bomet Town | cashier, main_bar, non_consumables, restaurant | YES |
| 3 | Kaplong | cashier, main_bar, other, restaurant | NO |
| 4 | Sotik | cashier, main_bar, other, restaurant | YES |
| 5 | Mogogoshiek | cashier, main_bar, other, restaurant | YES (anomaly) |
| 6 | Kaptote | cashier, main_bar, other, restaurant | NO |
| 7 | Litein | cashier, main_bar, other, restaurant | NO |
| 8 | Kapsoit | cashier, main_bar, other, restaurant | NO |
| 9 | Grill | cashier, main_bar, other, restaurant | NO |
| 10 | Guesthouse | cashier, main_bar, other, restaurant | NO |

---

## 4. Food-Control Tables (186 — categorised)

### 4.1 POS Sales Layer

| Table | Rows | Purpose |
|-------|------|---------|
| pos_shift_orders | 4,195 | **Primary sales table** — all orders with JSONB items |
| pos_outlet_items | 904 | Till menu catalog per outlet |
| pos_outlets | 45 | Outlet definitions (type, branch) |
| pos_outlet_assignments | 0 | Staff-to-outlet assignments |
| pos_shift_payments | — | Payment breakdowns per shift |
| pos_shifts | — | POS shift sessions |
| pos_item_void_requests | — | Line-item void requests |
| pos_item_void_log | — | Approved void audit trail |
| pos_void_requests | — | Whole-bill void requests |
| cashier_shifts | — | Cashier reconciliation sessions |
| cashier_clearances | — | Shift clearance records |
| shift_financials | — | Summarised financial totals |

### 4.2 Dead/Legacy Tables (do not use)

| Table | Rows | Status |
|-------|------|--------|
| restaurant_orders | 0 | DEAD — replaced by pos_shift_orders |
| restaurant_order_items | 0 | DEAD — replaced by JSONB items |

### 4.3 Bar Stock Control Layer

| Table | Rows | Purpose |
|-------|------|---------|
| bar_drinks | 256 | Bar item catalog (branch-scoped) |
| bar_drink_categories | — | Category definitions |
| bar_stock | 255 | Live stock balance per drink per branch |
| bar_stock_ledger | 1,832 | All bar stock movements (sale/restock/reversal) |
| bar_stocktake_records | 1,071 | Daily physical count records |
| bar_stock_requests | — | Bar replenishment requests |
| bar_stock_request_items | — | Lines of replenishment requests |

### 4.4 Kitchen / Restaurant Stock Control

| Table | Rows | Purpose |
|-------|------|---------|
| kitchen_stocktake_shifts | 16 | Kitchen daily count session headers |
| kitchen_stocktake_items | 304 | Kitchen daily count line items |
| kitchen_shifts | 7 | Kitchen production shifts |
| kitchen_stock | — | Kitchen stock balance |
| kitchen_daily_variance | — | Kitchen variance records |
| kitchen_expected_portions | — | Standard portions expected |
| kitchen_food_controls | — | Kitchen food control rules |
| kitchen_shift_pos_consumption | — | Theoretical consumption from POS |
| kitchen_wastage | — | Wastage header |
| kitchen_wastage_records | — | Wastage line items |
| kitchen_usage | — | Usage tracking |
| kitchen_production_sessions | — | Production session records |
| kitchen_production_recipes | — | Production recipe links |

### 4.5 Restaurant Menu

| Table | Rows | Purpose |
|-------|------|---------|
| restaurant_menu_items | 482 | Restaurant menu catalog |
| restaurant_menu_categories | 18 | Menu categories |
| menu_item_branch_pricing | — | Branch-specific price overrides |
| menu_items | — | Legacy menu items table |

### 4.6 Inventory / Stock Master

| Table | Rows | Purpose |
|-------|------|---------|
| inventory_items | 832 | Master item catalog (SKU-based, FG-xxx) |
| simple_items | 832 | VIEW of inventory_items (same data) |
| branch_stock | 1,155 | Branch stock balances |
| branch_stock_movements | 759 | All branch stock movement types |
| stock_counts | — | Stocktake sessions |
| stock_count_items | — | Stocktake line items |
| store_stocktake_records | — | Central store stocktake |
| central_stock_take_sessions | — | Central stocktake headers |
| central_stock_take_items | — | Central stocktake lines |

### 4.7 Recipes / Standards

| Table | Rows | Purpose |
|-------|------|---------|
| recipes | 13 | Recipe headers (yield-based) |
| recipe_items | 16 | Ingredient lines per recipe |
| recipe_change_log | — | Recipe edit history |
| production_recipes | — | Production-level recipes |
| production_run_inputs | — | Inputs for a production run |
| production_run_outputs | — | Outputs from a production run |
| kitchen_production_recipes | — | Kitchen-specific recipes |

### 4.8 Procurement & Receiving

| Table | Rows | Purpose |
|-------|------|---------|
| suppliers | 41 | Supplier master |
| purchase_orders | 7 | PO headers |
| purchase_order_items | 178 | PO line items |
| goods_receipts | — | GRN headers |
| goods_receipt_lines | — | GRN line items |
| store_grn | — | Store-level GRN headers |
| store_grn_items | — | Store GRN line items |

### 4.9 Stock Requisition & Dispatch

| Table | Rows | Purpose |
|-------|------|---------|
| stock_requests | 14 | Branch requisition headers |
| stock_request_items | 149 | Requisition line items |
| dispatch_notes | 10 | Dispatch note headers |
| dispatch_note_items | — | Dispatched quantities |
| in_transit_stock | — | Stock in transit tracking |

### 4.10 Wastage / Spoilage

| Table | Purpose |
|-------|---------|
| spoilage_records | Branch-level spoilage |
| branch_spoilage_log | Branch spoilage log |
| central_spoilage_log | Central store spoilage |
| kitchen_wastage | Kitchen wastage header |
| kitchen_wastage_records | Kitchen wastage detail |
| kitchen_wastage_alerts | Alert thresholds |

### 4.11 Food Control / Variance

| Table | Purpose |
|-------|---------|
| food_control_variance | Theoretical vs actual variance |
| food_control_direct_items | Items tracked directly |
| food_control_exempt_items | Items exempt from control |
| branch_food_control_config | Per-branch food control settings |
| kitchen_variance_logs | Kitchen variance audit |
| kitchen_variance_reasons | Variance reason codes |

---

## 5. Core Table Column Reference

### pos_shift_orders

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | uuid | NO | gen_random_uuid() | PK |
| shift_id | uuid | NO | — | FK → shifts |
| outlet_id | uuid | NO | — | FK → pos_outlets |
| branch_id | integer | YES | — | Denormalised |
| order_number | text | YES | — | Human reference |
| customer_name | text | YES | — | |
| order_type | text | YES | dine_in | dine_in/takeaway/room |
| table_number | text | YES | — | |
| room_number | text | YES | — | |
| waiter_id | uuid | YES | — | FK → staff |
| waiter_name | text | YES | — | Denormalised |
| status | text | NO | open | open/paid/voided/credit_bill |
| payment_status | text | NO | unpaid | unpaid/paid/partial/voided/credit_bill |
| total_amount | numeric | NO | 0 | Gross total |
| amount_paid | numeric | NO | 0 | Amount received |
| items | jsonb | YES | [] | **ALL LINE ITEMS** |
| voided_at | timestamptz | YES | — | Void timestamp |
| voided_by | uuid | YES | — | |
| void_reason | text | YES | — | |
| inventory_posted_at | timestamptz | YES | — | Stock deduction timestamp |
| bill_reprint_count | integer | NO | 0 | Reprint audit |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

### JSONB items[] field keys

| Key | Type | Notes |
|-----|------|-------|
| name | string | Item name |
| quantity | number | Ordered quantity |
| unit_price | number | Price per unit |
| line_total | number | quantity × unit_price |
| active_qty | number | quantity − voided_qty |
| active_total | number | active_qty × unit_price |
| voided_qty | number | Voided quantity on this line |
| is_fully_voided | bool | Entire line voided |
| void_pending_approval | bool | Awaiting manager approval |
| outlet_item_id | uuid | FK → pos_outlet_items |
| category | string | Item category |
| item_group | string | bar / restaurant / other |
| item_group_label | string | Display label |
| outlet_type | string | Outlet type string |
| outlet_name | string | Outlet name string |
| kitchen_status | string | pending/sent/ready/served |
| kitchen_ready_at | string | ISO timestamp |
| is_recalled_item | bool | Recalled from kitchen |
| recalled_at | string | ISO timestamp |
| recall_batch_id | string | Recall reference |
| recall_note | string | Recall reason |
| notes | string | Order notes |

---

## 6. Foreign Key Summary (key relationships)

| From Table | Column | → Target Table | Column |
|------------|--------|----------------|--------|
| pos_outlets | branch_id | → branches | id |
| pos_outlet_items | outlet_id | → pos_outlets | id |
| pos_shift_orders | outlet_id | → pos_outlets | id |
| pos_shift_orders | shift_id | → shifts | id |
| bar_drinks | branch_id | → branches | id |
| bar_drinks | inventory_item_id | → inventory_items | id |
| bar_stock | drink_id | → bar_drinks | id |
| bar_stock_ledger | drink_id | → bar_drinks | id |
| bar_stocktake_records | item_id | → inventory_items | id |
| branch_stock | item_sku | → simple_items | sku |
| recipe_items | recipe_id | → recipes | id |
| recipe_items | item_sku | → simple_items | sku |
| recipes | menu_item_id | → restaurant_menu_items | id |
| stock_requests | branch_id | → branches | id |
| dispatch_notes | stock_request_id | → stock_requests | id |
| kitchen_stocktake_items | shift_id | → kitchen_stocktake_shifts | id |

---

## 7. Status Fields Quick Reference

| Table | Column | Valid Values |
|-------|--------|-------------|
| pos_shift_orders | payment_status | unpaid, paid, partial, voided, credit_bill |
| pos_shift_orders | status | open, paid, voided, credit_bill |
| bar_stocktake_records | status | pending, reviewed, approved, rejected |
| kitchen_stocktake_shifts | status | draft, submitted, approved, rejected |
| stock_requests | status | APPROVED, REJECTED, DELIVERED, DISPATCHED |
| stock_requests | workflow_status | branch_accountant_approved, branch_accountant_rejected, in_transit, received |
| dispatch_notes | status | DRAFT, READY, DISPATCHED, DELIVERED |
| recipes | status | active, inactive |
| food_control_variance | status | open, resolved |
| cashier_shifts | status | open, closed, approved, flagged |
| branch_stock_movements | movement_type | DISPATCH_OUT, DISPATCH_RECEIVE, INITIAL_STOCK, KITCHEN_SHIFT_ADD_STOCK, KITCHEN_SHIFT_OPEN, PASTRY_PRODUCTION, PASTRY_ISSUE_TO_KITCHEN, MANUAL_ADJUSTMENT |
| bar_stock_ledger | transaction_type | sale, sale_reversal, restock |

---

*End of database_structure_report.md*
