# FamousGates Schema Audit Report

**Generated:** 2026-04-15T07:29:12.217Z

## Summary

- **Tables in schema:** 271
- **Files scanned:** 1782
- **Supabase queries found:** 370
- **API calls found:** 213
- **Zod schemas found:** 0
- **TypeScript types found:** 1035

## Error Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 64 |
| 🟠 HIGH | 275 |
| 🟡 MEDIUM | 0 |
| **TOTAL** | **339** |

## 🔴 Critical Errors

### 1. [COL_NOT_EXIST] backend\apply-security-migration.js:48

**Description:** Payload contains field "error" which does not exist in table "_migrations"

**Table:** _migrations

**Field:** error

**Available Columns:** id, name, executed_at

**Fix:** Remove "error" from payload or add column to table schema

---

### 2. [COL_NOT_EXIST] backend\fix-famousgate-users.js:66

**Description:** Payload contains field "error" which does not exist in table "users"

**Table:** users

**Field:** error

**Available Columns:** id, email, first_name, last_name, role, avatar, department, phone_number, address, created_at, updated_at, last_login, password_changed_at

**Fix:** Remove "error" from payload or add column to table schema

---

### 3. [MISSING_REQUIRED] backend\fix-famousgate-users.js:66

**Description:** INSERT missing required columns: email, first_name, last_name, role

**Table:** users

**Fix:** Add these required fields to the insert payload: email, first_name, last_name, role

---

### 4. [COL_NOT_EXIST] backend\src\controllers\accounting.controller.ts:960

**Description:** Payload contains field "error" which does not exist in table "approval_requests"

**Table:** approval_requests

**Field:** error

**Available Columns:** id, branch_id, request_type, reference_table, requested_by, approver_id, status, priority, amount, description, approved_at, rejected_at, rejection_reason, created_at, updated_at, reference_id

**Fix:** Remove "error" from payload or add column to table schema

---

### 5. [MISSING_REQUIRED] backend\src\controllers\accounting.controller.ts:960

**Description:** INSERT missing required columns: request_type, reference_table, requested_by, reference_id

**Table:** approval_requests

**Fix:** Add these required fields to the insert payload: request_type, reference_table, requested_by, reference_id

---

### 6. [COL_NOT_EXIST] backend\src\controllers\accounting.controller.ts:1034

**Description:** Payload contains field "error" which does not exist in table "approval_requests"

**Table:** approval_requests

**Field:** error

**Available Columns:** id, branch_id, request_type, reference_table, requested_by, approver_id, status, priority, amount, description, approved_at, rejected_at, rejection_reason, created_at, updated_at, reference_id

**Fix:** Remove "error" from payload or add column to table schema

---

### 7. [MISSING_REQUIRED] backend\src\controllers\accounting.controller.ts:1034

**Description:** INSERT missing required columns: request_type, reference_table, requested_by, reference_id

**Table:** approval_requests

**Fix:** Add these required fields to the insert payload: request_type, reference_table, requested_by, reference_id

---

### 8. [MISSING_REQUIRED] backend\src\controllers\auditor-advanced.controller.ts:350

**Description:** INSERT missing required columns: entity_type

**Table:** audit_trail

**Fix:** Add these required fields to the insert payload: entity_type

---

### 9. [COL_NOT_EXIST] backend\src\controllers\auditor.controller.ts:2142

**Description:** Payload contains field "error" which does not exist in table "stock_counts"

**Table:** stock_counts

**Field:** error

**Available Columns:** verified_by, verified_at, audit_notes, updated_at, status

**Fix:** Remove "error" from payload or add column to table schema

---

### 10. [COL_NOT_EXIST] backend\src\controllers\cashier-log.controller_concept.ts:27

**Description:** Payload contains field "error" which does not exist in table "staff_credit_bills"

**Table:** staff_credit_bills

**Field:** error

**Available Columns:** status, deducted_in_payroll_id, shift_id, paid_in_shift_id, paid_via_payroll_run_id, source_logbook_id

**Fix:** Remove "error" from payload or add column to table schema

---

### 11. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:912

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 12. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:1007

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 13. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:1272

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 14. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:1354

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 15. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:1453

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 16. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:3655

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 17. [MISSING_REQUIRED] backend\src\controllers\cashier.controller.ts:3692

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 18. [MISSING_REQUIRED] backend\src\controllers\conference.controller.ts:635

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 19. [MISSING_REQUIRED] backend\src\controllers\payment.controller.ts:267

**Description:** INSERT missing required columns: branch_id, transaction_type

**Table:** folio_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type

---

### 20. [MISSING_REQUIRED] backend\src\controllers\payment.controller.ts:612

**Description:** INSERT missing required columns: branch_id, transaction_type, cashier_id

**Table:** cashier_transactions

**Fix:** Add these required fields to the insert payload: branch_id, transaction_type, cashier_id

---

### 21. [COL_NOT_EXIST] backend\src\controllers\payroll-simple.controller.ts:45

**Description:** Payload contains field "payroll_id" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** payroll_id

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "payroll_id" from payload or add column to table schema

---

### 22. [COL_NOT_EXIST] backend\src\controllers\payroll-simple.controller.ts:200

**Description:** Payload contains field "payroll_id" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** payroll_id

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "payroll_id" from payload or add column to table schema

---

### 23. [COL_NOT_EXIST] backend\src\controllers\payroll-simple.controller.ts:228

**Description:** Payload contains field "remaining_balance" which does not exist in table "staff_loans"

**Table:** staff_loans

**Field:** remaining_balance

**Available Columns:** id, staff_id, branch_id, loan_number, loan_type, interest_rate, total_amount, balance, disbursement_date, repayment_start_date, repayment_end_date, monthly_installment, installments_paid, total_installments, status, approved_by, approved_at, disbursed_by, disbursed_at, guarantor_name, guarantor_phone, notes, created_at, updated_at, principal_amount, requested_by

**Fix:** Remove "remaining_balance" from payload or add column to table schema

---

### 24. [COL_NOT_EXIST] backend\src\controllers\payroll.controller.ts:338

**Description:** Payload contains field "payroll_id" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** payroll_id

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "payroll_id" from payload or add column to table schema

---

### 25. [COL_NOT_EXIST] backend\src\controllers\payroll.controller.ts:363

**Description:** Payload contains field "remaining_balance" which does not exist in table "staff_loans"

**Table:** staff_loans

**Field:** remaining_balance

**Available Columns:** id, staff_id, branch_id, loan_number, loan_type, interest_rate, total_amount, balance, disbursement_date, repayment_start_date, repayment_end_date, monthly_installment, installments_paid, total_installments, status, approved_by, approved_at, disbursed_by, disbursed_at, guarantor_name, guarantor_phone, notes, created_at, updated_at, principal_amount, requested_by

**Fix:** Remove "remaining_balance" from payload or add column to table schema

---

### 26. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\branch-inventory.controller.ts:547

**Description:** Query references table "vehicles" which does not exist in schema

**Table:** vehicles

**Fix:** Check table name spelling or create the table in migrations

---

### 27. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\branch-inventory.controller.ts:570

**Description:** Query references table "drivers" which does not exist in schema

**Table:** drivers

**Fix:** Check table name spelling or create the table in migrations

---

### 28. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\config.controller.ts:9

**Description:** Query references table "simple_app_config" which does not exist in schema

**Table:** simple_app_config

**Fix:** Check table name spelling or create the table in migrations

---

### 29. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\config.controller.ts:240

**Description:** Query references table "simple_app_config" which does not exist in schema

**Table:** simple_app_config

**Fix:** Check table name spelling or create the table in migrations

---

### 30. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\config.controller.ts:257

**Description:** Query references table "simple_app_config" which does not exist in schema

**Table:** simple_app_config

**Fix:** Check table name spelling or create the table in migrations

---

### 31. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\config.controller.ts:415

**Description:** Query references table "simple_shop_items" which does not exist in schema

**Table:** simple_shop_items

**Fix:** Check table name spelling or create the table in migrations

---

### 32. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\dispatch-notes.controller.ts:509

**Description:** Query references table "vehicles" which does not exist in schema

**Table:** vehicles

**Fix:** Check table name spelling or create the table in migrations

---

### 33. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\dispatch-notes.controller.ts:532

**Description:** Query references table "drivers" which does not exist in schema

**Table:** drivers

**Fix:** Check table name spelling or create the table in migrations

---

### 34. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\items.controller.ts:310

**Description:** Query references table "stock_history" which does not exist in schema

**Table:** stock_history

**Fix:** Check table name spelling or create the table in migrations

---

### 35. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\items.controller.ts:379

**Description:** Query references table "stock_history" which does not exist in schema

**Table:** stock_history

**Fix:** Check table name spelling or create the table in migrations

---

### 36. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\items.controller.ts:454

**Description:** Query references table "stock_history" which does not exist in schema

**Table:** stock_history

**Fix:** Check table name spelling or create the table in migrations

---

### 37. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\items.controller.ts:542

**Description:** Query references table "stock_history" which does not exist in schema

**Table:** stock_history

**Fix:** Check table name spelling or create the table in migrations

---

### 38. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\kitchen-usage.controller.ts:232

**Description:** Query references table "kitchen_usage_records" which does not exist in schema

**Table:** kitchen_usage_records

**Fix:** Check table name spelling or create the table in migrations

---

### 39. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\resources.controller.ts:69

**Description:** Query references table "vehicles" which does not exist in schema

**Table:** vehicles

**Fix:** Check table name spelling or create the table in migrations

---

### 40. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\resources.controller.ts:203

**Description:** Query references table "drivers" which does not exist in schema

**Table:** drivers

**Fix:** Check table name spelling or create the table in migrations

---

### 41. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\resources.controller.ts:979

**Description:** Query references table "stock_count_items" which does not exist in schema

**Table:** stock_count_items

**Fix:** Check table name spelling or create the table in migrations

---

### 42. [TABLE_NOT_EXIST] backend\src\controllers\storekeeping\transfers.controller.ts:8

**Description:** Query references table "simple_app_config" which does not exist in schema

**Table:** simple_app_config

**Fix:** Check table name spelling or create the table in migrations

---

### 43. [TABLE_NOT_EXIST] backend\src\models\Guest.ts:98

**Description:** Query references table "guests" which does not exist in schema

**Table:** guests

**Fix:** Check table name spelling or create the table in migrations

---

### 44. [COL_NOT_EXIST] backend\src\scripts\migrate_adjustments.js:27

**Description:** Payload contains field "error" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** error

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "error" from payload or add column to table schema

---

### 45. [MISSING_REQUIRED] backend\src\scripts\migrate_adjustments.js:27

**Description:** INSERT missing required columns: branch_id, staff_id, adjustment_type, effective_date

**Table:** staff_payroll_adjustments

**Fix:** Add these required fields to the insert payload: branch_id, staff_id, adjustment_type, effective_date

---

### 46. [COL_NOT_EXIST] backend\src\scripts\migrate_adjustments.js:61

**Description:** Payload contains field "error" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** error

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "error" from payload or add column to table schema

---

### 47. [MISSING_REQUIRED] backend\src\scripts\migrate_adjustments.js:61

**Description:** INSERT missing required columns: branch_id, staff_id, adjustment_type, effective_date

**Table:** staff_payroll_adjustments

**Fix:** Add these required fields to the insert payload: branch_id, staff_id, adjustment_type, effective_date

---

### 48. [COL_NOT_EXIST] backend\src\scripts\migrate_adjustments.js:94

**Description:** Payload contains field "error" which does not exist in table "staff_payroll_adjustments"

**Table:** staff_payroll_adjustments

**Field:** error

**Available Columns:** branch_id, id, staff_id, payroll_run_id, adjustment_type, description, effective_date, created_by, approved_by, approved_at, status, notes, created_at, updated_at, category, amount

**Fix:** Remove "error" from payload or add column to table schema

---

### 49. [MISSING_REQUIRED] backend\src\scripts\migrate_adjustments.js:94

**Description:** INSERT missing required columns: branch_id, staff_id, adjustment_type, effective_date

**Table:** staff_payroll_adjustments

**Fix:** Add these required fields to the insert payload: branch_id, staff_id, adjustment_type, effective_date

---

### 50. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:744

**Description:** Query references table "in_transit_stock" which does not exist in schema

**Table:** in_transit_stock

**Fix:** Check table name spelling or create the table in migrations

---

### 51. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1096

**Description:** Query references table "vehicles" which does not exist in schema

**Table:** vehicles

**Fix:** Check table name spelling or create the table in migrations

---

### 52. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1097

**Description:** Query references table "drivers" which does not exist in schema

**Table:** drivers

**Fix:** Check table name spelling or create the table in migrations

---

### 53. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1098

**Description:** Query references table "dispatch_items" which does not exist in schema

**Table:** dispatch_items

**Fix:** Check table name spelling or create the table in migrations

---

### 54. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1214

**Description:** Query references table "dispatch_notes" which does not exist in schema

**Table:** dispatch_notes

**Fix:** Check table name spelling or create the table in migrations

---

### 55. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1216

**Description:** Query references table "dispatch_notes" which does not exist in schema

**Table:** dispatch_notes

**Fix:** Check table name spelling or create the table in migrations

---

### 56. [TABLE_NOT_EXIST] backend\src\services\branch-inventory.service.ts:1260

**Description:** Query references table "dispatch_notes" which does not exist in schema

**Table:** dispatch_notes

**Fix:** Check table name spelling or create the table in migrations

---

### 57. [COL_NOT_EXIST] backend\src\utils\audit.ts:105

**Description:** Payload contains field "error" which does not exist in table "security_events"

**Table:** security_events

**Field:** error

**Available Columns:** id, event_type, description, metadata, resolved_at, created_at

**Fix:** Remove "error" from payload or add column to table schema

---

### 58. [MISSING_REQUIRED] backend\src\utils\audit.ts:105

**Description:** INSERT missing required columns: event_type, description

**Table:** security_events

**Fix:** Add these required fields to the insert payload: event_type, description

---

### 59. [TABLE_NOT_EXIST] backend\test_insert.js:29

**Description:** Query references table "stock_count_items" which does not exist in schema

**Table:** stock_count_items

**Fix:** Check table name spelling or create the table in migrations

---

### 60. [TABLE_NOT_EXIST] backend\test_insert.js:48

**Description:** Query references table "stock_count_items" which does not exist in schema

**Table:** stock_count_items

**Fix:** Check table name spelling or create the table in migrations

---

### 61. [TABLE_NOT_EXIST] backend\verify-folio-fix.ts:85

**Description:** Query references table "folios" which does not exist in schema

**Table:** folios

**Fix:** Check table name spelling or create the table in migrations

---

### 62. [TABLE_NOT_EXIST] backend\verify-room-logic.ts:105

**Description:** Query references table "guests" which does not exist in schema

**Table:** guests

**Fix:** Check table name spelling or create the table in migrations

---

### 63. [TABLE_NOT_EXIST] backend\verify-room-logic.ts:119

**Description:** Query references table "folios" which does not exist in schema

**Table:** folios

**Fix:** Check table name spelling or create the table in migrations

---

### 64. [TABLE_NOT_EXIST] backend\verify-room-logic.ts:131

**Description:** Query references table "guests" which does not exist in schema

**Table:** guests

**Fix:** Check table name spelling or create the table in migrations

---

## 🟠 High Severity Errors

### 1. [MISSING_BRANCH_SCOPE] backend\check-room-123.ts:7

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 2. [MISSING_BRANCH_SCOPE] backend\debug_profiles.js:23

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 3. [MISSING_BRANCH_SCOPE] backend\scripts\assign_rooms_to_bomet.js:79

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 4. [MISSING_BRANCH_SCOPE] backend\scripts\check_reports_data.js:14

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 5. [MISSING_BRANCH_SCOPE] backend\scripts\check_reports_data.js:21

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 6. [MISSING_BRANCH_SCOPE] backend\scripts\check_reports_data.js:29

**Description:** SELECT on branch-scoped table "expenses" missing .eq('branch_id', ...) filter

**Table:** expenses

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 7. [MISSING_BRANCH_SCOPE] backend\scripts\check_sample_data.js:12

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 8. [MISSING_BRANCH_SCOPE] backend\scripts\check_sample_data.js:20

**Description:** SELECT on branch-scoped table "expenses" missing .eq('branch_id', ...) filter

**Table:** expenses

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 9. [NO_ERROR_CHECK] backend\src\controllers\admin-logs.controller.ts:104

**Description:** Supabase query without error handling

**Table:** auth_logs

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 10. [NO_ERROR_CHECK] backend\src\controllers\admin-logs.controller.ts:107

**Description:** Supabase query without error handling

**Table:** audit_trail

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 11. [NO_ERROR_CHECK] backend\src\controllers\admin-logs.controller.ts:111

**Description:** Supabase query without error handling

**Table:** audit_night_sessions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 12. [NO_ERROR_CHECK] backend\src\controllers\admin-logs.controller.ts:115

**Description:** Supabase query without error handling

**Table:** security_events

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 13. [MISSING_BRANCH_SCOPE] backend\src\controllers\advances.controller.ts:57

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 14. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:167

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 15. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:167

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 16. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:169

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 17. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:169

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 18. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:221

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 19. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:221

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 20. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:222

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 21. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:222

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 22. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:223

**Description:** Supabase query without error handling

**Table:** reservations

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 23. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:224

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 24. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:225

**Description:** Supabase query without error handling

**Table:** payments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 25. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:299

**Description:** Supabase query without error handling

**Table:** audit_exceptions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 26. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:301

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 27. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:301

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 28. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:303

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 29. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:303

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 30. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:305

**Description:** Supabase query without error handling

**Table:** branch_stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 31. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:360

**Description:** SELECT on branch-scoped table "expenses" missing .eq('branch_id', ...) filter

**Table:** expenses

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 32. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:360

**Description:** Supabase query without error handling

**Table:** expenses

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 33. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:362

**Description:** Supabase query without error handling

**Table:** petty_cash_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 34. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:424

**Description:** Supabase query without error handling

**Table:** branch_stock

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 35. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:426

**Description:** Supabase query without error handling

**Table:** branch_stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 36. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:432

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 37. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:497

**Description:** Supabase query without error handling

**Table:** branch_stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 38. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:499

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 39. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:505

**Description:** Supabase query without error handling

**Table:** stock_request_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 40. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:508

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 41. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:508

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 42. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:560

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 43. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:573

**Description:** Supabase query without error handling

**Table:** stock_request_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 44. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:581

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 45. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:581

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 46. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:589

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 47. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:599

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 48. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:670

**Description:** Supabase query without error handling

**Table:** audit_exceptions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 49. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:672

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 50. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:672

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 51. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:674

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 52. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:674

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 53. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:676

**Description:** SELECT on branch-scoped table "expenses" missing .eq('branch_id', ...) filter

**Table:** expenses

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 54. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:676

**Description:** Supabase query without error handling

**Table:** expenses

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 55. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:736

**Description:** Supabase query without error handling

**Table:** stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 56. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:742

**Description:** Supabase query without error handling

**Table:** inventory_transfers

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 57. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:749

**Description:** Supabase query without error handling

**Table:** branch_stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 58. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:758

**Description:** Supabase query without error handling

**Table:** inventory_transfer_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 59. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor-reports.controller.ts:775

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 60. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:775

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 61. [NO_ERROR_CHECK] backend\src\controllers\auditor-reports.controller.ts:778

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 62. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:517

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 63. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:518

**Description:** Supabase query without error handling

**Table:** audit_plans

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 64. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:653

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 65. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:654

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 66. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:654

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 67. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:655

**Description:** Supabase query without error handling

**Table:** restaurant_pool_token_sales

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 68. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:656

**Description:** Supabase query without error handling

**Table:** payments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 69. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:657

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 70. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:769

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 71. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:880

**Description:** Supabase query without error handling

**Table:** reservations

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 72. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:881

**Description:** Supabase query without error handling

**Table:** accounting_ar_invoices

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 73. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:882

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 74. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:882

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 75. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:883

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 76. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:883

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 77. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:884

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 78. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:959

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 79. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:960

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 80. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1007

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 81. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1007

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 82. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1013

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 83. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1013

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 84. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1130

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 85. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1130

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 86. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1135

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 87. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1135

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 88. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1140

**Description:** Supabase query without error handling

**Table:** reservations

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 89. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1145

**Description:** Supabase query without error handling

**Table:** outside_catering_bookings

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 90. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1150

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 91. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1154

**Description:** Supabase query without error handling

**Table:** unpaid_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 92. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1159

**Description:** Supabase query without error handling

**Table:** restaurant_pool_token_sales

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 93. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1214

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 94. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1219

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 95. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1242

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 96. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1254

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 97. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1529

**Description:** Supabase query without error handling

**Table:** branch_stock_movements

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 98. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1762

**Description:** Supabase query without error handling

**Table:** stock_request_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 99. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1763

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 100. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1764

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 101. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1773

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 102. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1773

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 103. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1774

**Description:** SELECT on branch-scoped table "inventory_items" missing .eq('branch_id', ...) filter

**Table:** inventory_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 104. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1774

**Description:** Supabase query without error handling

**Table:** inventory_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 105. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1876

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 106. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1876

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 107. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:1877

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 108. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1877

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 109. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1878

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 110. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1894

**Description:** Supabase query without error handling

**Table:** restaurant_order_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 111. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1895

**Description:** Supabase query without error handling

**Table:** bar_order_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 112. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:1896

**Description:** Supabase query without error handling

**Table:** stock_request_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 113. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:2065

**Description:** Supabase query without error handling

**Table:** restaurant_bar_inventory

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 114. [MISSING_BRANCH_SCOPE] backend\src\controllers\auditor.controller.ts:2066

**Description:** SELECT on branch-scoped table "store_items" missing .eq('branch_id', ...) filter

**Table:** store_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 115. [NO_ERROR_CHECK] backend\src\controllers\auditor.controller.ts:2066

**Description:** Supabase query without error handling

**Table:** store_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 116. [MISSING_BRANCH_SCOPE] backend\src\controllers\cashier-shifts.controller.ts:116

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 117. [NO_ERROR_CHECK] backend\src\controllers\cashier-shifts.controller.ts:116

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 118. [MISSING_BRANCH_SCOPE] backend\src\controllers\cashier-shifts.controller.ts:120

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 119. [NO_ERROR_CHECK] backend\src\controllers\cashier-shifts.controller.ts:120

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 120. [MISSING_BRANCH_SCOPE] backend\src\controllers\cashier-shifts.controller.ts:248

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 121. [NO_ERROR_CHECK] backend\src\controllers\cashier-shifts.controller.ts:248

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 122. [MISSING_BRANCH_SCOPE] backend\src\controllers\cashier-shifts.controller.ts:252

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 123. [NO_ERROR_CHECK] backend\src\controllers\cashier-shifts.controller.ts:252

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 124. [NO_ERROR_CHECK] backend\src\controllers\cashier.controller.ts:552

**Description:** Supabase query without error handling

**Table:** unpaid_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 125. [NO_ERROR_CHECK] backend\src\controllers\catering.controller.ts:18

**Description:** Supabase query without error handling

**Table:** outside_catering_bookings

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 126. [MISSING_BRANCH_SCOPE] backend\src\controllers\credit-bills.controller.ts:74

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 127. [NO_ERROR_CHECK] backend\src\controllers\credit-bills.controller.ts:74

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 128. [NO_ERROR_CHECK] backend\src\controllers\credit-bills.controller.ts:78

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 129. [NO_ERROR_CHECK] backend\src\controllers\finance.controller.ts:1535

**Description:** Supabase query without error handling

**Table:** accounting_ar_invoices

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 130. [NO_ERROR_CHECK] backend\src\controllers\finance.controller.ts:1536

**Description:** Supabase query without error handling

**Table:** accounting_ap_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 131. [MISSING_BRANCH_SCOPE] backend\src\controllers\loans.controller.ts:59

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 132. [NO_ERROR_CHECK] backend\src\controllers\loans.controller.ts:59

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 133. [NO_ERROR_CHECK] backend\src\controllers\loans.controller.ts:63

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 134. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:23

**Description:** Supabase query without error handling

**Table:** payment_verifications

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 135. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:44

**Description:** Supabase query without error handling

**Table:** banking_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 136. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:74

**Description:** Supabase query without error handling

**Table:** payments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 137. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:92

**Description:** Supabase query without error handling

**Table:** reservations

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 138. [MISSING_BRANCH_SCOPE] backend\src\controllers\payments.controller.ts:93

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 139. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:93

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 140. [MISSING_BRANCH_SCOPE] backend\src\controllers\payments.controller.ts:94

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 141. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:94

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 142. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:95

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 143. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:153

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 144. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:575

**Description:** Supabase query without error handling

**Table:** payment_verifications

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 145. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:592

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 146. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:603

**Description:** Supabase query without error handling

**Table:** payments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 147. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:619

**Description:** Supabase query without error handling

**Table:** reservations

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 148. [MISSING_BRANCH_SCOPE] backend\src\controllers\payments.controller.ts:620

**Description:** SELECT on branch-scoped table "restaurant_orders" missing .eq('branch_id', ...) filter

**Table:** restaurant_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 149. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:620

**Description:** Supabase query without error handling

**Table:** restaurant_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 150. [MISSING_BRANCH_SCOPE] backend\src\controllers\payments.controller.ts:621

**Description:** SELECT on branch-scoped table "bar_orders" missing .eq('branch_id', ...) filter

**Table:** bar_orders

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 151. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:621

**Description:** Supabase query without error handling

**Table:** bar_orders

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 152. [NO_ERROR_CHECK] backend\src\controllers\payments.controller.ts:622

**Description:** Supabase query without error handling

**Table:** pos_transactions

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 153. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:35

**Description:** Supabase query without error handling

**Table:** staff_advances

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 154. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:38

**Description:** Supabase query without error handling

**Table:** staff_credit_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 155. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:41

**Description:** Supabase query without error handling

**Table:** unpaid_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 156. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:45

**Description:** Supabase query without error handling

**Table:** staff_payroll_adjustments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 157. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:200

**Description:** Supabase query without error handling

**Table:** staff_payroll_adjustments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 158. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:207

**Description:** Supabase query without error handling

**Table:** staff_advances

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 159. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:214

**Description:** Supabase query without error handling

**Table:** staff_credit_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 160. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:221

**Description:** Supabase query without error handling

**Table:** unpaid_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 161. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:228

**Description:** Supabase query without error handling

**Table:** staff_loans

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 162. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:361

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 163. [NO_ERROR_CHECK] backend\src\controllers\payroll-simple.controller.ts:367

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 164. [NO_ERROR_CHECK] backend\src\controllers\payroll.controller.ts:922

**Description:** Supabase query without error handling

**Table:** payroll_runs

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 165. [MISSING_BRANCH_SCOPE] backend\src\controllers\report.controller.ts:622

**Description:** SELECT on branch-scoped table "staff_payroll" missing .eq('branch_id', ...) filter

**Table:** staff_payroll

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 166. [MISSING_BRANCH_SCOPE] backend\src\controllers\staff.controller.ts:1195

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 167. [NO_ERROR_CHECK] backend\src\controllers\staff.controller.ts:1195

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 168. [MISSING_BRANCH_SCOPE] backend\src\controllers\staff.controller.ts:1432

**Description:** SELECT on branch-scoped table "staff_attendance" missing .eq('branch_id', ...) filter

**Table:** staff_attendance

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 169. [MISSING_BRANCH_SCOPE] backend\src\controllers\staff.controller.ts:1639

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 170. [NO_ERROR_CHECK] backend\src\controllers\staff.controller.ts:1639

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 171. [NO_ERROR_CHECK] backend\src\controllers\staff.controller.ts:1642

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 172. [NO_ERROR_CHECK] backend\src\controllers\staff.controller.ts:1648

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 173. [MISSING_BRANCH_SCOPE] backend\src\controllers\staff.controller.ts:1969

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 174. [NO_ERROR_CHECK] backend\src\controllers\staff.controller.ts:1969

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 175. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\branch-inventory.controller.ts:559

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 176. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\config.controller.ts:304

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 177. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\config.controller.ts:353

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 178. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\dispatch-notes.controller.ts:521

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 179. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\resources.controller.ts:1202

**Description:** SELECT on branch-scoped table "store_items" missing .eq('branch_id', ...) filter

**Table:** store_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 180. [MISSING_BRANCH_SCOPE] backend\src\controllers\storekeeping\transfers.controller.ts:240

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 181. [MISSING_BRANCH_SCOPE] backend\src\services\branch-inventory.service.ts:175

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 182. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:175

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 183. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:176

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 184. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1095

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 185. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1213

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 186. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1215

**Description:** Supabase query without error handling

**Table:** branch_stock

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 187. [MISSING_BRANCH_SCOPE] backend\src\services\branch-inventory.service.ts:1217

**Description:** SELECT on branch-scoped table "simple_items" missing .eq('branch_id', ...) filter

**Table:** simple_items

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 188. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1217

**Description:** Supabase query without error handling

**Table:** simple_items

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 189. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1257

**Description:** Supabase query without error handling

**Table:** branch_stock

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 190. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1258

**Description:** Supabase query without error handling

**Table:** branch_stock

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 191. [NO_ERROR_CHECK] backend\src\services\branch-inventory.service.ts:1259

**Description:** Supabase query without error handling

**Table:** stock_requests

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 192. [MISSING_BRANCH_SCOPE] backend\src\services\native-pdf-reports.service.ts:722

**Description:** SELECT on branch-scoped table "staff_profiles" missing .eq('branch_id', ...) filter

**Table:** staff_profiles

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 193. [NO_ERROR_CHECK] backend\src\services\native-pdf-reports.service.ts:722

**Description:** Supabase query without error handling

**Table:** staff_profiles

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 194. [NO_ERROR_CHECK] backend\src\services\native-pdf-reports.service.ts:726

**Description:** Supabase query without error handling

**Table:** users

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 195. [NO_ERROR_CHECK] backend\src\services\native-pdf-reports.service.ts:732

**Description:** Supabase query without error handling

**Table:** branches

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 196. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:49

**Description:** Supabase query without error handling

**Table:** staff_advances

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 197. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:57

**Description:** Supabase query without error handling

**Table:** staff_loans

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 198. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:64

**Description:** Supabase query without error handling

**Table:** staff_credit_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 199. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:72

**Description:** Supabase query without error handling

**Table:** cashier_logbook_lines

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 200. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:81

**Description:** Supabase query without error handling

**Table:** unpaid_bills

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 201. [MISSING_BRANCH_SCOPE] backend\src\services\payroll.service.ts:90

**Description:** SELECT on branch-scoped table "staff_leave" missing .eq('branch_id', ...) filter

**Table:** staff_leave

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 202. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:90

**Description:** Supabase query without error handling

**Table:** staff_leave

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 203. [MISSING_BRANCH_SCOPE] backend\src\services\payroll.service.ts:99

**Description:** SELECT on branch-scoped table "staff_attendance" missing .eq('branch_id', ...) filter

**Table:** staff_attendance

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 204. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:99

**Description:** Supabase query without error handling

**Table:** staff_attendance

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 205. [NO_ERROR_CHECK] backend\src\services\payroll.service.ts:107

**Description:** Supabase query without error handling

**Table:** staff_payroll_adjustments

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 206. [MISSING_BRANCH_SCOPE] backend\verify-room-logic.ts:12

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 207. [MISSING_BRANCH_SCOPE] backend\verify-room-logic.ts:58

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 208. [MISSING_BRANCH_SCOPE] backend\verify-room-logic.ts:91

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 209. [MISSING_BRANCH_SCOPE] backend\verify-room-status.ts:30

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 210. [MISSING_BRANCH_SCOPE] backend\verify-room-status.ts:42

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 211. [NO_ERROR_CHECK] backend\verify-room-status.ts:42

**Description:** Supabase query without error handling

**Table:** rooms

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 212. [MISSING_BRANCH_SCOPE] backend\verify-room-status.ts:50

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 213. [NO_ERROR_CHECK] backend\verify-room-status.ts:50

**Description:** Supabase query without error handling

**Table:** rooms

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 214. [MISSING_BRANCH_SCOPE] backend\verify-room-status.ts:58

**Description:** SELECT on branch-scoped table "rooms" missing .eq('branch_id', ...) filter

**Table:** rooms

**Fix:** Add .eq('branch_id', userBranchId) to the query

---

### 215. [NO_ERROR_CHECK] backend\verify-room-status.ts:58

**Description:** Supabase query without error handling

**Table:** rooms

**Fix:** Destructure { data, error } and check if (error) before using data

---

### 216. [MISSING_AUTH_HEADER] backend\diagnose-email-issue.js:43

**Description:** POST request to http://localhost:5001/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 217. [MISSING_AUTH_HEADER] backend\diagnose-email-issue.js:89

**Description:** POST request to http://localhost:5000/api/landing-email/confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 218. [MISSING_AUTH_HEADER] backend\resend-booking-emails.js:35

**Description:** POST request to ${BARCODE_SERVICE_URL}/api/barcode/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 219. [MISSING_AUTH_HEADER] backend\send-booking-emails.js:23

**Description:** POST request to http://localhost:5001/api/barcode/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 220. [MISSING_AUTH_HEADER] backend\send-emails-with-barcodes.js:23

**Description:** POST request to http://localhost:5001/api/barcode/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 221. [MISSING_AUTH_HEADER] backend\send-one-test-email.js:42

**Description:** POST request to http://localhost:5000/api/landing-email/confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 222. [MISSING_AUTH_HEADER] backend\src\controllers\cashier.controller.ts:2234

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 223. [MISSING_AUTH_HEADER] backend\src\controllers\cashier.controller.ts:2387

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 224. [MISSING_AUTH_HEADER] backend\src\controllers\conference.controller.ts:536

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 225. [MISSING_AUTH_HEADER] backend\src\controllers\report.controller.ts:396

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/reports/data?type=conference_summary missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 226. [MISSING_AUTH_HEADER] backend\src\controllers\report.controller.ts:589

**Description:** POST request to ${PYTHON_SERVICE_URL}${endpoint} missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 227. [MISSING_AUTH_HEADER] backend\src\controllers\report.controller.ts:798

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/payroll/generate-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 228. [MISSING_AUTH_HEADER] backend\src\controllers\report.controller.ts:837

**Description:** POST request to ${PYTHON_SERVICE_URL}/api/payroll/generate-xlsx missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 229. [MISSING_AUTH_HEADER] backend\src\controllers\report.controller.ts:856

**Description:** POST request to ${PYTHON_SERVICE_URL}${endpoint} missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 230. [MISSING_AUTH_HEADER] backend\src\routes\finance.routes.ts:222

**Description:** POST request to ${pythonUrl}/api/finance/journal-entries missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 231. [MISSING_AUTH_HEADER] backend\src\routes\finance.routes.ts:318

**Description:** POST request to ${pythonUrl}/api/finance/reports/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 232. [MISSING_AUTH_HEADER] backend\src\services\automation.service.ts:168

**Description:** POST request to ${process.env.PYTHON_SERVICE_URL ||  missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 233. [MISSING_AUTH_HEADER] backend\src\services\automation.service.ts:383

**Description:** POST request to ${process.env.PYTHON_SERVICE_URL ||  missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 234. [MISSING_AUTH_HEADER] backend\src\services\barcodeGenerator.service.ts:32

**Description:** POST request to ${this.pythonServiceUrl}/api/barcode/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 235. [MISSING_AUTH_HEADER] backend\src\services\barcodeGenerator.service.ts:63

**Description:** POST request to ${this.pythonServiceUrl}/api/barcode/generate-card missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 236. [MISSING_AUTH_HEADER] backend\src\services\barcodeGenerator.service.ts:89

**Description:** POST request to ${this.pythonServiceUrl}/api/barcode/generate-qr missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 237. [MISSING_AUTH_HEADER] backend\src\services\brevo-email.service.ts:104

**Description:** POST request to ${pdfServiceUrl}/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 238. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:83

**Description:** POST request to ${this.baseUrl}/api/communications/email missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 239. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:108

**Description:** POST request to ${this.baseUrl}/api/communications/sms missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 240. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:131

**Description:** POST request to ${this.baseUrl}/api/communications/email/booking-confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 241. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:162

**Description:** POST request to ${this.baseUrl}/api/communications/email/check-in-reminder missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 242. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:189

**Description:** POST request to ${this.baseUrl}/api/communications/email/invoice missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 243. [MISSING_AUTH_HEADER] backend\src\services\communication.service.ts:219

**Description:** POST request to ${this.baseUrl}/api/communications/sms/bulk missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 244. [MISSING_AUTH_HEADER] backend\src\services\emailAutomation.service.ts:46

**Description:** POST request to ${this.pythonServiceUrl}/api/email/schedule-booking-emails missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 245. [MISSING_AUTH_HEADER] backend\src\services\emailAutomation.service.ts:126

**Description:** POST request to ${this.pythonServiceUrl}/api/email/send-immediate-email missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 246. [MISSING_AUTH_HEADER] backend\src\services\mpesa.service.ts:287

**Description:** POST request to ${this.baseURL}/mpesa/accountbalance/v1/query missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 247. [MISSING_AUTH_HEADER] backend\src\services\paystack.service.ts:164

**Description:** POST request to ${this.baseURL}/transferrecipient missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 248. [MISSING_AUTH_HEADER] backend\src\services\paystack.service.ts:238

**Description:** POST request to ${this.baseURL}/transfer/bulk missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 249. [MISSING_AUTH_HEADER] backend\src\services\pricing.service.ts:22

**Description:** POST request to ${PRICING_SERVICE_URL}/api/pricing/calculate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 250. [MISSING_AUTH_HEADER] backend\test-brevo-api.js:43

**Description:** POST request to ${BACKEND_URL}/api/landing-email/confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 251. [MISSING_AUTH_HEADER] backend\test-email-with-pdf.js:31

**Description:** POST request to http://localhost:5001/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 252. [MISSING_AUTH_HEADER] backend\test-email-with-pdf.js:56

**Description:** POST request to http://localhost:5000/api/landing-email/confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 253. [MISSING_AUTH_HEADER] backend\test-landing-email.js:39

**Description:** POST request to ${BACKEND_URL}/api/landing-email/confirmation missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 254. [MISSING_AUTH_HEADER] backend\test-login.js:16

**Description:** POST request to http://localhost:5000/api/auth/login missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 255. [MISSING_AUTH_HEADER] backend\test_close_shift.js:48

**Description:** POST request to ${API_URL}/cashier/shifts/start missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 256. [MISSING_AUTH_HEADER] backend\test_close_shift.js:94

**Description:** PUT request to ${API_URL}/cashier/shifts/${shiftId}/close missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 257. [MISSING_AUTH_HEADER] frontend\backup_20251202_224038\components\modals\EventModal.tsx:52

**Description:** POST request to /api/events missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 258. [MISSING_AUTH_HEADER] frontend\src\app\(public)\booking\page.tsx:133

**Description:** POST request to ${API_URL}/api/bookings missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 259. [MISSING_AUTH_HEADER] frontend\src\app\(public)\booking\page.tsx:158

**Description:** POST request to ${API_URL}/api/payments/booking/initiate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 260. [MISSING_AUTH_HEADER] frontend\src\app\dashboard\bar\cashier\page.tsx:140

**Description:** POST request to ${pythonUrl}/pos/forecast missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 261. [MISSING_AUTH_HEADER] frontend\src\app\dashboard\branch-manager\attendance\page.tsx:165

**Description:** POST request to ${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 262. [MISSING_AUTH_HEADER] frontend\src\app\dashboard\cashier\page.tsx:324

**Description:** POST request to ${pythonUrl}/pos/forecast missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 263. [MISSING_AUTH_HEADER] frontend\src\app\dashboard\reception\checkin\page.tsx:266

**Description:** POST request to ${PYTHON_API_URL}/api/reports/generate/checkout-bill missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 264. [MISSING_AUTH_HEADER] frontend\src\app\dashboard\reception\checkin\page.tsx:321

**Description:** POST request to ${PYTHON_API_URL}/api/finance/verify-anomaly missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 265. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingBarcodeCard.tsx:46

**Description:** POST request to /api/barcode/generate missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 266. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingBarcodeCard.tsx:64

**Description:** POST request to /api/barcode/generate-qr missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 267. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingBarcodeCard.tsx:81

**Description:** POST request to /api/barcode/generate-card missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 268. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingManagementModal.tsx:101

**Description:** PUT request to /api/bookings/${booking.id}/modify missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 269. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingManagementModal.tsx:140

**Description:** PUT request to /api/bookings/${booking.id}/cancel missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 270. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingManagementModal.tsx:171

**Description:** PUT request to /api/bookings/${booking.id}/check-in missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 271. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingManagementModal.tsx:198

**Description:** PUT request to /api/bookings/${booking.id}/check-out missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 272. [MISSING_AUTH_HEADER] frontend\src\components\booking\BookingModal.tsx:287

**Description:** POST request to /api/bookings missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 273. [MISSING_AUTH_HEADER] frontend\src\components\booking\GuestPortal.tsx:88

**Description:** PUT request to /api/bookings/${booking.id}/modify missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 274. [MISSING_AUTH_HEADER] frontend\src\components\booking\GuestPortal.tsx:125

**Description:** PUT request to /api/bookings/${booking.id}/cancel missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

### 275. [MISSING_AUTH_HEADER] frontend\src\components\modals\EventModal.tsx:52

**Description:** POST request to /api/events missing Authorization header

**Fix:** Add Authorization: Bearer ${token} header to the request

---

