# Payroll, HR & Deductions — Database Schema Reference

> Reflects the **live database** as of March 2026. All tables use UUID primary keys and have RLS enabled.

---

## Table of Contents

1. [staff_payroll](#1-staff_payroll)
2. [staff_payroll_adjustments](#2-staff_payroll_adjustments)
3. [staff_credit_bills](#3-staff_credit_bills)
4. [staff_advances](#4-staff_advances)
5. [staff_loans](#5-staff_loans)
6. [unpaid_bills](#6-unpaid_bills)
7. [Deduction Logic Summary](#7-deduction-logic-summary)
8. [Status Reference](#8-status-reference)

---

## 1. `staff_payroll`

The main payroll record generated per staff member per month.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `staff_id` | UUID | NO | FK → `staff_profiles.id` |
| `month` | VARCHAR(20) | NO | Month number as string e.g. `"4"` |
| `year` | INTEGER | NO | e.g. `2026` |
| `basic_salary` | DECIMAL(10,2) | NO | Base salary from staff profile |
| `allowances` | DECIMAL(10,2) | YES | From approved adjustments (type=addition, category=allowance) |
| `bonuses` | DECIMAL(10,2) | YES | From approved adjustments (type=addition, other categories) |
| `nssf` | DECIMAL(10,2) | YES | Only from explicit adjustment (category=nssf). Never auto-calculated |
| `nssf_deduction` | DECIMAL(10,2) | YES | Mirror of nssf |
| `shif_deduction` | DECIMAL(10,2) | YES | Only from explicit adjustment (category=shif) |
| `housing_levy` | DECIMAL(10,2) | YES | Only from explicit adjustment (category=housing_levy) |
| `housing_levy_deduction` | DECIMAL(10,2) | YES | Mirror of housing_levy |
| `paye` | DECIMAL(10,2) | YES | Only from explicit adjustment (category=paye) |
| `nhif` | DECIMAL(10,2) | YES | Legacy field, always 0 |
| `total_advances` | DECIMAL(10,2) | YES | Sum of approved advances deducted this month |
| `loan_deduction` | DECIMAL(10,2) | YES | Sum of active loan installments deducted this month |
| `total_credit_bills` | DECIMAL(10,2) | YES | Sum of pending credit bills deducted this month |
| `total_deductions` | DECIMAL(10,2) | YES | Grand total of all deductions |
| `net_pay` | DECIMAL(10,2) | NO | `basic_salary + allowances + bonuses - total_deductions` |
| `status` | TEXT | NO | `draft` \| `processed` \| `paid` |
| `payment_date` | TIMESTAMPTZ | YES | When payment was made |
| `generated_at` | TIMESTAMPTZ | NO | When this record was generated |

**Unique constraint:** `(staff_id, month, year)` — one record per staff per month.

---

## 2. `staff_payroll_adjustments`

Manual adjustments created by HR/Auditor. This is the **only** source for statutory deductions (NSSF, SHIF, Housing Levy, PAYE).

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `staff_id` | UUID | NO | FK → `staff_profiles.id` |
| `type` | TEXT | NO | `addition` \| `deduction` |
| `category` | TEXT | NO | See categories below |
| `amount` | DECIMAL(10,2) | NO | Amount of adjustment |
| `description` | TEXT | YES | Notes |
| `month` | TEXT | NO | Month string e.g. `"4"` |
| `year` | INTEGER | NO | e.g. `2026` |
| `status` | TEXT | NO | `pending` → `applied` after payroll run |
| `payroll_id` | UUID | YES | FK → `staff_payroll.id` (set when applied) |
| `created_by` | UUID | YES | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | |
| `updated_at` | TIMESTAMPTZ | YES | |

**Categories for `type=deduction`:**
- `nssf` — NSSF statutory deduction
- `shif` — SHIF (Social Health Insurance Fund)
- `housing_levy` — Affordable Housing Levy
- `paye` — Pay As You Earn tax
- `uniform` — Uniform deduction
- `absent_day` — Absence penalty
- *(any other)* — Falls into misc deductions

**Categories for `type=addition`:**
- `allowance` — Added to allowances bucket
- *(any other)* — Added to bonuses bucket

---

## 3. `staff_credit_bills`

Staff food/service credit consumed on-site, recorded by cashiers. Auto-deducted on next payroll run.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `staff_id` | UUID | NO | FK → `staff_profiles.id` |
| `amount` | DECIMAL(10,2) | NO | Bill amount (must be > 0) |
| `description` | TEXT | NO | e.g. "LUNCH", "DINNER" |
| `bill_date` | DATE | NO | Date of consumption |
| `status` | TEXT | NO | See status values below |
| `deducted_in_payroll_id` | UUID | YES | FK → `staff_payroll.id` (set when deducted) |
| `branch_id` | INTEGER | YES | FK → `branches.id` |
| `date` | DATE | YES | Legacy column (old schema) |
| `is_paid` | BOOLEAN | YES | Legacy column (old schema) |
| `payroll_id` | UUID | YES | Legacy column (old schema) |
| `balance` | DECIMAL(10,2) | YES | Legacy column |
| `created_at` | TIMESTAMPTZ | NO | |

**Status values:** `pending` → `deducted` (via payroll) or `paid_cash` (paid directly) or `cancelled`

**Payroll picks up:** only `status = 'pending'` records.

---

## 4. `staff_advances`

Salary advance requests. Must be approved before payroll deducts them.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `staff_id` | UUID | NO | FK → `staff_profiles.id` |
| `amount` | DECIMAL(10,2) | NO | Advance amount (must be > 0) |
| `reason` | TEXT | NO | Reason for advance |
| `advance_date` | DATE | NO | Date of advance |
| `month_to_deduct` | INTEGER | NO | Month payroll should deduct (1–12) |
| `year_to_deduct` | INTEGER | NO | Year payroll should deduct |
| `status` | TEXT | NO | See status values below |
| `approved_by` | UUID | YES | FK → `users.id` |
| `deducted_in_payroll_id` | UUID | YES | FK → `staff_payroll.id` (set when deducted) |
| `branch_id` | INTEGER | YES | FK → `branches.id` |
| `request_date` | DATE | YES | Legacy column (old schema) |
| `payroll_id` | UUID | YES | Legacy column (old schema) |
| `created_at` | TIMESTAMPTZ | NO | |

**Status values:** `pending` → `approved` (by manager/accountant) → `deducted` (by payroll) or `cancelled`

**Payroll picks up:** `status = 'approved'` AND `month_to_deduct = payroll_month` AND `year_to_deduct = payroll_year`.

---

## 5. `staff_loans`

Long-term loans repaid in monthly installments. Deducted automatically each month once the deduction period starts.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `staff_id` | UUID | NO | FK → `staff_profiles.id` |
| `total_amount` | DECIMAL(10,2) | NO | Total loan amount |
| `installment_amount` | DECIMAL(10,2) | NO | Monthly deduction amount |
| `remaining_balance` | DECIMAL(10,2) | NO | Outstanding balance (decremented each payroll) |
| `reason` | TEXT | NO | Purpose of loan |
| `loan_date` | DATE | NO | Date loan was issued |
| `start_deduction_month` | INTEGER | NO | Month deductions begin (1–12) |
| `start_deduction_year` | INTEGER | NO | Year deductions begin |
| `status` | TEXT | NO | See status values below |
| `approved_by` | UUID | YES | FK → `users.id` |
| `branch_id` | INTEGER | YES | FK → `branches.id` |
| `monthly_installment` | DECIMAL(10,2) | YES | Legacy column (old schema) |
| `start_date` | DATE | YES | Legacy column (old schema) |
| `created_at` | TIMESTAMPTZ | NO | |

**Status values:** `pending_approval` → `active` (approved) → `paid` (balance = 0) or `cancelled`

**Payroll picks up:** `status = 'active'` AND `remaining_balance > 0` AND deduction period has started (`start_deduction_year/month <= payroll year/month`).

Each payroll run deducts `MIN(installment_amount, remaining_balance)` and updates `remaining_balance`. When balance hits 0, status is set to `paid`.

---

## 6. `unpaid_bills`

Customer/waiter unpaid bills. Waiter bills are auto-deducted from payroll.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `bill_number` | VARCHAR(50) | NO | Unique bill reference |
| `branch_id` | UUID | NO | FK → `branches.id` |
| `bill_type` | VARCHAR(50) | NO | `restaurant` \| `bar` \| `room_service` \| `accommodation` \| `other` |
| `reference_type` | VARCHAR(50) | YES | `restaurant_order` \| `bar_order` \| `booking` etc. |
| `reference_id` | UUID | YES | ID of related order/booking |
| `customer_type` | VARCHAR(20) | NO | `guest` \| `walk_in` \| `staff` \| `waiter` |
| `customer_id` | UUID | YES | FK → `users.id` |
| `customer_name` | VARCHAR(255) | NO | Display name |
| `room_number` | VARCHAR(20) | YES | For hotel guests |
| `waiter_id` | UUID | YES | FK → `users.id` — if set, payroll deducts from this staff |
| `total_amount` | DECIMAL(10,2) | NO | Original bill total |
| `paid_amount` | DECIMAL(10,2) | NO | Amount paid so far |
| `balance_amount` | DECIMAL(10,2) | NO | `total_amount - paid_amount` |
| `bill_date` | DATE | NO | Date of bill |
| `due_date` | DATE | YES | Payment due date |
| `status` | VARCHAR(20) | NO | `unpaid` \| `partial` \| `paid` \| `overdue` \| `written_off` \| `deducted` |
| `payment_terms` | VARCHAR(50) | YES | `immediate` \| `end_of_stay` \| `credit_30_days` etc. |
| `remarks` | TEXT | YES | Notes |
| `accountant_confirmed_at` | TIMESTAMPTZ | YES | Accountant confirmation timestamp |
| `accountant_id` | UUID | YES | FK → `users.id` |
| `auditor_confirmed_at` | TIMESTAMPTZ | YES | Auditor confirmation timestamp |
| `auditor_id` | UUID | YES | FK → `users.id` |
| `items` | JSONB | YES | Bill line items |
| `created_by` | UUID | YES | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | |
| `updated_at` | TIMESTAMPTZ | YES | |

**Payroll picks up:** `status = 'unpaid'` AND `waiter_id = staff.id`. Deducts `balance_amount`, sets status to `deducted`.

---

## 7. Deduction Logic Summary

| Deduction Type | Source Table | Trigger Condition | Auto? |
|---|---|---|---|
| NSSF | `staff_payroll_adjustments` | `type=deduction, category=nssf, status=pending` | NO — manual only |
| SHIF | `staff_payroll_adjustments` | `type=deduction, category=shif, status=pending` | NO — manual only |
| Housing Levy | `staff_payroll_adjustments` | `type=deduction, category=housing_levy, status=pending` | NO — manual only |
| PAYE | `staff_payroll_adjustments` | `type=deduction, category=paye, status=pending` | NO — manual only |
| Salary Advance | `staff_advances` | `status=approved, month_to_deduct=month, year_to_deduct=year` | YES |
| Loan Installment | `staff_loans` | `status=active, remaining_balance>0, start period ≤ payroll month` | YES |
| Credit Bills | `staff_credit_bills` | `status=pending` | YES |
| Unpaid Bills | `unpaid_bills` | `status=unpaid, waiter_id=staff_id` | YES |
| Uniform/Absence/Other | `staff_payroll_adjustments` | `type=deduction, other categories, status=pending` | NO — manual only |

**Net Pay formula:**
```
gross = basic_salary + allowances + bonuses
deductions = nssf + shif + housing_levy + paye + advances + loans + credit_bills + unpaid_bills + misc_adjustments
net_pay = gross - deductions
```

---

## 8. Status Reference

### `staff_credit_bills.status`
| Value | Meaning |
|---|---|
| `pending` | Awaiting payroll deduction |
| `deducted` | Deducted via payroll run |
| `paid_cash` | Staff paid directly (cash/mpesa) |
| `cancelled` | Voided |

### `staff_advances.status`
| Value | Meaning |
|---|---|
| `pending` | Submitted, awaiting approval |
| `approved` | Approved — will be deducted on target month |
| `deducted` | Deducted via payroll run |
| `cancelled` | Rejected or voided |

### `staff_loans.status`
| Value | Meaning |
|---|---|
| `pending_approval` | Submitted, awaiting approval |
| `active` | Approved — installments being deducted monthly |
| `paid` | Fully repaid (remaining_balance = 0) |
| `cancelled` | Rejected or voided |

### `staff_payroll.status`
| Value | Meaning |
|---|---|
| `draft` | Generated but not yet finalized |
| `processed` | Reviewed and confirmed |
| `paid` | Payment disbursed |

### `staff_payroll_adjustments.status`
| Value | Meaning |
|---|---|
| `pending` | Awaiting payroll run |
| `applied` | Included in a payroll record |

### `unpaid_bills.status`
| Value | Meaning |
|---|---|
| `unpaid` | Outstanding |
| `partial` | Partially paid |
| `paid` | Fully settled |
| `overdue` | Past due date |
| `written_off` | Written off |
| `deducted` | Deducted via payroll |
