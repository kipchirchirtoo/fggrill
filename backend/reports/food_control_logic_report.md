# Famous Gates Hotels — Food Control Logic Report
*Based on live database inspection. Generated 2026-07-01.*

## 1. Three-Tier Food Control System

TIER 1 — BAR CONTROL: POS Sale → bar_stock_ledger(sale) → bar_stock.current_stock updated → Daily physical count → bar_stocktake_records → Accountant approves

TIER 2 — KITCHEN CONTROL: POS Sale in pos_shift_orders.items[] JSONB → Storekeeper records opening/added/closing per shift → kitchen_stocktake_items (variance = closing - opening - added) → Accountant reviews

TIER 3 — STORE CONTROL: Branch requests → stock_requests → dispatch_notes → DISPATCH_RECEIVE → branch_stock updated

## 2. POS Sales Architecture

### Dead Tables (0 rows each — do not use)
- restaurant_orders: 0 rows
- restaurant_order_items: 0 rows

### Active Sales Table
pos_shift_orders: 4,195 rows
- paid: 3,629 (86.5%)
- voided: 273 (6.5%)
- credit_bill: 257 (6.1%)
- open: 36 (0.9%)

All line items stored in pos_shift_orders.items (JSONB array). See pos_sales_mapping.md for full key list.

### Void Handling
Order-level: payment_status = 'voided'
Line-level (JSONB): voided_qty, active_qty = quantity - voided_qty, is_fully_voided
Use active_qty for food cost calculations. Exclude voided orders entirely.

## 3. Bar Stock Control

### Sale Flow
Bartender sells → pos_outlet_items.source_item_id → bar_drinks.id → bar_stock_ledger (type=sale) → bar_stock.current_stock decremented

### Ledger Activity
- sale: 1,661
- sale_reversal: 122
- restock: 49

### Daily Stocktake Formula
system_qty = opening + additions - sales
variance = physical - system (must have reason if != 0)
Status flow: pending → reviewed → approved/rejected

### Active Branches
- Branch 2 (Bomet Town): 117 drinks, all linked to inventory_items
- Branch 4 (Sotik): 139 drinks, all linked to inventory_items
- Branches 1,3,5,6,7,8,9,10: 0 bar_drinks rows

## 4. Kitchen Stocktake

### Structure
kitchen_stocktake_shifts (header): branch_id, stocktake_date, shift A/B, status
kitchen_stocktake_items (lines): item_name (FREE TEXT), opening_qty, added_qty, closing_qty, variance
variance = closing - opening - added
inventory_item_id = NULL on ALL 304 rows (no catalog link)

### Variance Meaning
variance < 0: Consumed (sold + wastage + staff meals)
variance > 0: Surplus
variance = 0: No net movement

## 5. Recipe System

### Structure
recipes → menu_item_id → restaurant_menu_items
recipe_items → item_sku → simple_items/inventory_items
Qty per portion = quantity_required / output_quantity

### 13 Recipes — BOMET TOWN (branch 2) ONLY
| Recipe | Output | Ingredient | Qty/Batch | Qty/Portion |
|--------|--------|-----------|-----------|-------------|
| Chapati | 30p | EXE ALL PURPOSE (FG-3) | 2.0 kg | 0.0667 kg |
| Samosa | 30p | MINCED MEAT (FG-80) | 1.0 kg | 0.0333 kg |
| Chips | 3p | POTATOES (FG-86) | 2.0 kg | 0.6667 kg |
| Ugali | 15p | AJAB UGALI (FG-2) | 2.0 kg | 0.1333 kg |
| Tea | 4p | MILK PACKET (FG-106) | 1.0 L | 0.2500 L |

NOTE: recipe_items.inventory_item_id = NULL on ALL 16 rows. Cost joins must use item_sku.
CRITICAL: 9 of 10 branches have ZERO recipes. Expected food cost cannot be calculated.

## 6. Stock Requisition Flow

stock_requests (branch creates)
→ branch_accountant_approved
→ dispatch_notes created (central store)
→ DISPATCHED (in_transit)
→ DELIVERED (received)
→ branch_stock updated via DISPATCH_RECEIVE movement

Current activity: 8 delivered, 2 approved, 2 dispatched, 2 rejected

## 7. POS Outlet Item Linkage

| Branch | Outlet | Items | Linked | Source Table | Issue |
|--------|--------|-------|--------|-------------|-------|
| 2 | main_bar | 118 | 117 | bar_drinks | 1 unlinked |
| 2 | restaurant | 162 | 153 | restaurant_menu_items | 9 unlinked |
| 4 | main_bar | 139 | 139 | bar_drinks | OK |
| 5 | main_bar | 138 | 138 | restaurant_menu_items | WRONG TABLE |
| 5 | restaurant | 187 | 187 | restaurant_menu_items | OK |
| 1,3,6-10 | all | 0 | 0 | — | NOT SEEDED |

CRITICAL: Branch 5 Main Bar links to restaurant_menu_items instead of bar_drinks — bar stock NOT deducted.

## 8. Food Cost Calculation Guide

### Bar Food Cost %
Numerator: SUM(bar_stocktake_records.physical_quantity * bar_drinks.cost_price) WHERE status='approved'
Denominator: SUM(bar_stock_ledger.quantity * bar_drinks.selling_price) WHERE type='sale'
= Actual Cost / Revenue * 100

### Kitchen Food Cost % (Bomet Town only)
Numerator: SUM(consumed_qty * inventory_items.default_unit_cost)
  where consumed_qty = opening_qty + added_qty - closing_qty from kitchen_stocktake_items
Denominator: SUM(POS revenue from restaurant outlet)

### Expected vs Actual Variance (Recipe-Based)
Expected = SUM(POS qty sold * recipe qty per portion)
Actual = SUM(opening + added - closing from kitchen_stocktake_items)
Variance = Actual - Expected

## 9. Critical Gaps Summary

| # | Gap | Severity |
|---|-----|----------|
| 1 | Recipes only for 1/10 branches | CRITICAL |
| 2 | recipe_items.inventory_item_id = NULL | HIGH |
| 3 | 7 branches: no pos_outlet_items | CRITICAL |
| 4 | Branch 5 Main Bar: wrong link table | HIGH |
| 5 | Kitchen items: free text, no inventory_item_id | HIGH |
| 6 | bar_stock.par_level = 0 everywhere | MEDIUM |
| 7 | KITCHEN MENU cost_price = 0 | HIGH |
| 8 | No unit conversion table | MEDIUM |

*End of food_control_logic_report.md*
