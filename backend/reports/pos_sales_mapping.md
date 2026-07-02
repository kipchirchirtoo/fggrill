# Famous Gates Hotels - POS Sales Mapping
Generated 2026-07-01. Read-only live database audit.

## 1. Architecture: ALL Sales via pos_shift_orders JSONB

Primary sales table: pos_shift_orders (4,195 rows)
Dead tables (0 rows): restaurant_orders, restaurant_order_items - DO NOT USE

## 2. JSONB Items Array - 23 Keys Per Line Item

| Field | Type | Purpose |
|-------|------|---------|
| name | string | Item name |
| quantity | number | Ordered qty |
| unit_price | number | Price/unit (KES) |
| line_total | number | quantity x unit_price |
| active_qty | number | quantity - voided_qty |
| active_total | number | active_qty x unit_price |
| voided_qty | number | Units voided |
| is_fully_voided | bool | Entire line cancelled |
| void_pending_approval | bool | Pending manager approval |
| outlet_item_id | uuid | FK pos_outlet_items.id |
| category | string | Item category |
| item_group | string | bar/restaurant/other |
| item_group_label | string | Display label |
| outlet_type | string | Outlet type |
| outlet_name | string | Outlet name |
| kitchen_status | string | pending/sent/ready/served |
| kitchen_ready_at | string | ISO timestamp |
| is_recalled_item | bool | Recalled from kitchen |
| recalled_at | string | Recall timestamp |
| recall_batch_id | string | Recall reference |
| recall_note | string | Recall reason |
| notes | string | Order notes |

## 3. Order Status Summary

| payment_status | count | pct |
|---------------|-------|-----|
| paid | 3629 | 86.5 |
| voided | 273 | 6.5 |
| credit_bill | 257 | 6.1 |
| unpaid | 35 | 0.8 |
| partial | 1 | 0.0 |
| TOTAL | 4195 | 100 |

## 4. SQL: Net Sales by Branch/Outlet/Date

`sql
SELECT
    b.name AS branch,
    po.outlet_type,
    DATE(pso.created_at) AS sale_date,
    COUNT(DISTINCT pso.id) AS order_count,
    SUM((elem->>'active_qty')::numeric * (elem->>'unit_price')::numeric) AS net_sales
FROM pos_shift_orders pso
JOIN pos_outlets po ON po.id = pso.outlet_id
JOIN branches b ON b.id = po.branch_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pso.items, '[]'::jsonb)) AS elem
WHERE pso.payment_status NOT IN ('voided')
  AND (elem->>'is_fully_voided')::boolean IS DISTINCT FROM true
GROUP BY b.name, po.outlet_type, DATE(pso.created_at)
ORDER BY sale_date DESC, branch;
`

## 5. SQL: Top 20 Selling Items

`sql
SELECT
    elem->>'name' AS item_name,
    elem->>'category' AS category,
    elem->>'item_group' AS item_group,
    SUM((elem->>'active_qty')::numeric) AS qty_sold,
    SUM((elem->>'active_qty')::numeric * (elem->>'unit_price')::numeric) AS revenue
FROM pos_shift_orders pso
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pso.items, '[]'::jsonb)) AS elem
WHERE pso.payment_status NOT IN ('voided')
  AND (elem->>'is_fully_voided')::boolean IS DISTINCT FROM true
GROUP BY elem->>'name', elem->>'category', elem->>'item_group'
ORDER BY revenue DESC LIMIT 20;
`

## 6. SQL: Void Analysis

`sql
SELECT
    po.branch_id, po.outlet_type,
    COUNT(*) AS total_orders,
    COUNT(CASE WHEN pso.payment_status = 'voided' THEN 1 END) AS voided,
    ROUND(COUNT(CASE WHEN pso.payment_status = 'voided' THEN 1 END) * 100.0 / NULLIF(COUNT(*),0), 1) AS void_pct,
    SUM(CASE WHEN pso.payment_status = 'voided' THEN pso.total_amount ELSE 0 END) AS voided_amount
FROM pos_shift_orders pso
JOIN pos_outlets po ON po.id = pso.outlet_id
GROUP BY po.branch_id, po.outlet_type ORDER BY po.branch_id;
`

## 7. SQL: Bill Reprint Audit

`sql
SELECT branch_id, order_number, bill_reprint_count, total_amount, created_at
FROM pos_shift_orders
WHERE bill_reprint_count > 0
ORDER BY bill_reprint_count DESC;
`

## 8. Cashier Reconciliation Flow

POS shift opens -> pos_shifts record
Orders placed -> pos_shift_orders (shift_id FK)
Payments recorded -> pos_shift_payments (cash/mpesa/card/credit)
Shift closes -> cashier_shifts record:
  total_sales, expected_cash, actual_cash, discrepancy_amount, opening_float, closing_float
Accountant reviews -> cashier_clearances (status: approved/flagged)

## 9. POS Outlet Item Seeding Status

| Branch | Outlet | Items | Linked | Source Table | Issue |
|--------|--------|-------|--------|-------------|-------|
| 2 Bomet | main_bar | 118 | 117 | bar_drinks | 1 unlinked |
| 2 Bomet | restaurant | 162 | 153 | restaurant_menu_items | 9 unlinked |
| 4 Sotik | main_bar | 139 | 139 | bar_drinks | OK |
| 5 Mogo | main_bar | 138 | 138 | restaurant_menu_items | WRONG - should be bar_drinks |
| 5 Mogo | restaurant | 187 | 187 | restaurant_menu_items | OK |
| 1,3,6,7,8,9,10 | all | 0 | 0 | none | NOT SEEDED |

## 10. Credit Bills

257 orders with payment_status='credit_bill' linked to staff_credit_bill_id.
For food cost: INCLUDE in revenue (goods delivered). EXCLUDE from cash reconciliation.

## 11. POS Outlets Full List

| Branch | Name | Outlet Types |
|--------|------|-------------|
| 1 | Kyogong | cashier(x2), choma_zone, executive_bar, main_bar, other, restaurant, spa, sports_bar |
| 2 | Bomet Town | cashier, main_bar, non_consumables, restaurant |
| 3 | Kaplong | cashier, main_bar, other, restaurant |
| 4 | Sotik | cashier, main_bar, other, restaurant |
| 5 | Mogogoshiek | cashier, main_bar, other, restaurant |
| 6 | Kaptote | cashier, main_bar, other, restaurant |
| 7 | Litein | cashier, main_bar, other, restaurant |
| 8 | Kapsoit | cashier, main_bar, other, restaurant |
| 9 | Grill | cashier, main_bar, other, restaurant |
| 10 | Guesthouse | cashier, main_bar, other, restaurant |

End of pos_sales_mapping.md
