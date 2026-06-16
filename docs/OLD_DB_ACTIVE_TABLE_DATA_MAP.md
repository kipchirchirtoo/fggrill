# Old Database Active Table Data Map

Generated: 2026-06-14T15:04:56.805Z

This report lists only old `public` tables that contain data. It is the migration manifest for staging old rows into the new clean database under `legacy_import`, then transforming them into canonical tables.

## Summary

- Active old tables: 114
- Active old rows: 15307
- Empty old tables: intentionally excluded
- Target staging: `legacy_import.raw_table_manifest` and `legacy_import.raw_rows`

## Migration Status

- Staged into the new clean DB: 114 active tables, 15307 raw rows.
- Canonical identity/RBAC import completed:
  - `branches`: 10
  - `roles`: 20
  - `users`: 40
  - `departments`: 180
  - `staff_profiles`: 363
  - `staff_profiles_with_user_id`: 0
  - `user_branch_roles`: 72
- Important: canonical `users` contains login/auth accounts only. `staff_profiles` are separate HR/personnel records, exactly like the old DB. A staff profile links to `users.id` only when the legacy staff row has a real `user_id`; the old staged data currently has no such links.
- Important: `public.users.role` and `public.user_branch_roles.role` seed RBAC. `staff_profiles.role` is treated as staff/job metadata, not an application permission role.
- Remaining canonical ETL passes still needed: hotel/reception, POS/outlets, inventory truth, procurement/AP, branch request flow, department issues, stock take, finance/cashier, and audit/governance.

## Domain Breakdown

| Domain | Tables | Rows |
| --- | ---: | ---: |
| inventory_truth | 27 | 6399 |
| pos_outlets | 14 | 4290 |
| audit_governance | 6 | 1350 |
| procurement_ap | 9 | 1146 |
| finance_cashier | 7 | 929 |
| identity_org | 13 | 575 |
| legacy_review | 23 | 487 |
| hotel_reception | 10 | 111 |
| branch_request_flow | 3 | 7 |
| stock_take | 1 | 7 |
| department_issue_flow | 1 | 6 |

## Active Tables

| Old table | Rows | Canonical domain | Canonical target candidates | Primary key |
| --- | ---: | --- | --- | --- |
| `central_stock_take_items` | 2468 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `pos_outlet_items` | 1710 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `pos_shift_stock_counts` | 1286 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `auth_logs` | 1255 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `stock_count_items` | 1216 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `branch_stock` | 770 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `payroll_records` | 726 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `simple_items` | 648 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | sku |
| `store_grn_items` | 605 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `branch_stock_movements` | 551 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `stock_history` | 511 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `store_po_items` | 437 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `restaurant_menu_items` | 431 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `bar_drinks` | 402 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `staff_profiles` | 363 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `_migrations` | 189 | legacy_review | manual review | id |
| `pos_shift_orders` | 138 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `department_inventory_accounts` | 110 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `cashier_transactions` | 101 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `pos_outlets` | 90 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `pos_shift_payments` | 85 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `notifications` | 61 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `cashier_shift_transactions` | 57 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `rooms` | 55 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `schema_migrations` | 49 | legacy_review | manual review | id |
| `restaurant_menu_categories` | 46 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `daily_financial_records` | 43 | legacy_review | manual review | id |
| `reports` | 41 | legacy_review | manual review | id |
| `user_branch_roles` | 41 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `users` | 40 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `restaurant_order_items` | 37 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `store_suppliers` | 36 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `spa_services` | 34 | legacy_review | manual review | id |
| `staff_credit_bills` | 30 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `staff_payroll_items` | 27 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `staff_employment_history` | 26 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `store_purchase_orders` | 26 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `store_grn` | 25 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `stock_counts` | 24 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `dynamic_services` | 23 | legacy_review | manual review | id |
| `payroll_batch_lines` | 22 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `cashier_shift_logs` | 21 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `credit_bills` | 20 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `departments` | 20 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `restaurant_orders` | 20 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `kitchen_food_controls` | 18 | legacy_review | manual review | id |
| `pos_transactions` | 16 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `pos_outlet_shifts` | 15 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `kenyan_public_holidays` | 14 | legacy_review | manual review | id |
| `room_status_history` | 13 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `audit_trail` | 12 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `pos_void_requests` | 12 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `store_procurement_audit_logs` | 12 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `central_stock_take_sessions` | 11 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `branches` | 10 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `feature_flags` | 10 | legacy_review | manual review | id |
| `financial_daily_snapshots` | 10 | legacy_review | manual review | id |
| `inventory_audit_logs` | 10 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `accounting_chart_of_accounts` | 9 | legacy_review | manual review | id |
| `booking_history` | 9 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `staff_credit_bill_payments` | 9 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `conference_halls` | 8 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `inventory_movements` | 8 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `shift_types` | 8 | legacy_review | manual review | id |
| `inventory_balances` | 7 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `inventory_governance_rules` | 7 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `kitchen_variance_reasons` | 7 | stock_take | stock_takes, stock_take_lines, stock_take_variances | id |
| `room_types` | 7 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `simple_sequences` | 7 | legacy_review | manual review | sequence_name, sequence_date |
| `stock_request_items` | 7 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `accounting_journal_entries` | 6 | legacy_review | manual review | id |
| `folios` | 6 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `inventory_locations` | 6 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `reservations` | 6 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `security_alerts` | 6 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `stock_requests` | 6 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `superadmin_audit_log` | 6 | department_issue_flow | department_requests, material_issue_notes, material_issue_lines | id |
| `system_config_values` | 6 | legacy_review | manual review | key |
| `branch_payment_audit` | 5 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `branch_payments` | 5 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `lina_agent_logs` | 4 | audit_governance | audit_events, workflow_tasks, documents, notifications | id |
| `sales_points` | 4 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `scheduled_reports` | 4 | legacy_review | manual review | id |
| `stock_request_sequences` | 4 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | branch_code, sequence_date |
| `dispatch_items` | 3 | branch_request_flow | branch_requisitions, packing_sessions, dispatches, receipt_verifications | - |
| `dispatch_notes` | 3 | branch_request_flow | branch_requisitions, packing_sessions, dispatches, receipt_verifications | id |
| `guests` | 3 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `payments` | 3 | procurement_ap | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_payments, supplier_ledger | id |
| `report_jobs` | 3 | legacy_review | manual review | id |
| `shift_templates` | 3 | legacy_review | manual review | id |
| `sku_categories` | 3 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | code |
| `staff_attendance` | 3 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `staff_payroll_adjustments` | 3 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `vehicles` | 3 | legacy_review | manual review | id |
| `accounting_journal_lines` | 2 | legacy_review | manual review | id |
| `central_spoilage_log` | 2 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `impersonation_sessions` | 2 | legacy_review | manual review | id |
| `inventory_item_catalog` | 2 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `inventory_reservations` | 2 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `maintenance_spare_parts` | 2 | hotel_reception | guests, rooms, room_types, reservations, bookings, folios, housekeeping_tasks | id |
| `menu_item_branch_pricing` | 2 | pos_outlets | pos_outlets, menu_items, pos_outlet_items, pos_shifts, pos_orders, pos_order_lines, pos_payments | id |
| `order_sequences` | 2 | legacy_review | manual review | sequence_type, sequence_date |
| `payroll_deduction_rates` | 2 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `payroll_runs` | 2 | finance_cashier | cashier_shifts, cashier_transactions, branch_payments, credit_bills, bank_accounts, bank_reconciliations | id |
| `staff_advances` | 2 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `department_inventory_ledger` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `dispatch_sequences` | 1 | branch_request_flow | branch_requisitions, packing_sessions, dispatches, receipt_verifications | branch_code, sequence_date |
| `inventory_alerts` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `inventory_core_batches` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `kitchen_stock` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `kitchen_stock_ledger` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `payroll_batches` | 1 | inventory_truth | inventory_items, inventory_locations, inventory_batches, inventory_balances, inventory_movements, inventory_reservations, inventory_alerts | id |
| `staff_leave` | 1 | identity_org | branches, users, roles, user_branch_roles, staff_profiles, departments | id |
| `unpaid_bills` | 1 | legacy_review | manual review | id |

## Migration Rule

Do not recreate these old tables in `public`. Stage the rows into `legacy_import`, then migrate them into canonical domain tables with module ETL scripts. This keeps dirty old schemas out of the new application surface.
