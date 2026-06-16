# Clean DB ETL Map

The ETL must load dirty source data into `legacy_import` first, then transform
into canonical public tables.

## Source-to-Target Map

| Dirty source | Canonical target |
| --- | --- |
| `branches` | `branches` |
| `users`, `user_branch_roles` | `users`, `roles`, `user_branch_roles` |
| `staff_profiles` | `staff_profiles` |
| `simple_items`, `inventory_item_catalog`, `inventory_items` | `inventory_items` |
| `branch_stock` | `inventory_locations`, `inventory_balances` |
| `inventory_movements`, `branch_stock_movements`, `stock_history`, `department_inventory_ledger` | `inventory_movements` |
| `pos_outlets` | `pos_outlets`, `inventory_locations` |
| `restaurant_menu_items`, `bar_drinks`, `pos_outlet_items` | `menu_items`, `pos_outlet_items` |
| `store_purchase_orders`, `store_po_items` | `purchase_orders`, `purchase_order_lines` |
| `store_grn`, `store_grn_items` | `goods_receipts`, `goods_receipt_lines` |
| `store_supplier_invoices`, `store_supplier_payments`, `branch_payments` | `supplier_invoices`, `supplier_payments`, `supplier_payment_allocations`, `supplier_ledger` |
| `stock_counts`, `stock_count_items`, `central_stock_take_items` | `stock_takes`, `stock_take_lines`, `stock_take_variances` |
| `audit_logs`, `audit_trail`, `inventory_audit_logs`, `financial_audit_logs`, module audit tables | `audit_events` |

## Required Reconciliation

- Active source table row counts must match mapped target row counts or have a
  documented transformation reason.
- Every migrated balance must be explainable by opening balance + movements.
- Every branch-scoped row must have an integer `branch_id`.
- Every migrated payment linked to a supplier invoice must allocate to that
  invoice or remain as unapplied supplier credit.

