# Requirements Document

## Introduction

The Shift Closing Breakdown feature provides a comprehensive, auditable shift closing report for cashiers at FamousGate Hotels. When a cashier closes their shift, the system must calculate and display a full financial breakdown covering: opening float, sales by payment method, sales by revenue stream, credit bill activity, expected vs. actual cash, and variance. The report must be transparent, traceable, and consistent between the close-shift modal (data entry) and any post-close view (read-only summary).

The feature builds on the existing `cashier_shift_logs` table and `close-shift-modal.tsx` UI. It does not replace them — it enriches the closing flow with a structured breakdown panel and ensures the backend formula is consistent with what the frontend displays.

---

## Glossary

- **Shift_Log**: A record in `cashier_shift_logs` representing one cashier shift from start to close.
- **Opening_Float**: The cash amount placed in the drawer at the start of a shift.
- **Closing_Float**: The actual physical cash counted in the drawer at shift end.
- **Expected_Closing_Amount**: The calculated cash that should be in the drawer: `Opening Float + Total Cash Sales + Cash Received for Credit Bills Paid`.
- **Variance**: The difference between Actual Cash Counted and Expected Closing Amount. Positive = surplus, Negative = shortage.
- **Cash_Sales**: Payments received in physical cash during the shift.
- **MPesa_Sales**: Payments received via M-Pesa mobile money during the shift.
- **Card_Sales**: Payments received via card/POS during the shift.
- **Other_Sales**: Payments received via any method not covered by Cash, M-Pesa, or Card.
- **Total_Sales**: The sum of all sales across all payment methods.
- **Revenue_Stream**: A departmental source of income (e.g., Restaurant, Bar, Rooms, Pool, Conference).
- **Credit_Bill**: A bill issued to a staff member on credit — money owed to the hotel, not yet paid.
- **Credit_Bills_Created**: New credit bills issued during the shift (money taken on credit).
- **Credit_Bills_Paid**: Credit bills settled with cash during the shift.
- **Credit_Bills_Outstanding**: Credit bills that remain unpaid at shift close.
- **Shift_Breakdown_Report**: The structured summary panel shown during and after shift close.
- **Close_Shift_Modal**: The existing frontend modal at `close-shift-modal.tsx` used to submit shift closing data.
- **Cashier**: A hotel staff member with the `cashier` role who operates the cash drawer.
- **Accountant**: A staff member with `accountant` or `branch_accountant` role who reconciles shifts.
- **Auditor**: A staff member with the `auditor` role who verifies reconciled shifts.

---

## Requirements

### Requirement 1: Shift Breakdown Calculation

**User Story:** As a cashier, I want the system to automatically calculate my full shift breakdown when I close my shift, so that I have a clear, accurate financial summary without manual arithmetic.

#### Acceptance Criteria

1. WHEN a cashier submits the close-shift form, THE Shift_Log SHALL be updated with all calculated breakdown fields before the response is returned.
2. THE Shift_Log SHALL store `total_cash_sales`, `total_mpesa_sales`, `total_card_sales`, and `total_sales` derived from recorded shift transactions.
3. WHERE an `other_revenue` value is entered by the cashier, THE Shift_Log SHALL store it as a separate field distinct from cash, M-Pesa, and card sales.
4. THE Shift_Log SHALL store revenue totals for each revenue stream: `restaurant_revenue`, `bar_revenue`, `room_booking_revenue`, `conference_revenue`, `swimming_pool_revenue`, `pool_token_revenue`, and `other_revenue`.
5. THE Shift_Log SHALL store `credit_bills_taken` (total value of new credit bills issued), `credit_bills_count`, `paid_bills_value` (cash received for credit settlements), `paid_bills_count`, and `unpaid_bills_value` (outstanding credit balance).
6. WHEN the close-shift form is submitted, THE System SHALL calculate `unpaid_bills_value` as `credit_bills_taken - paid_bills_value`.
7. THE Shift_Log SHALL store `expected_closing_float` calculated as: `opening_float + total_cash_sales + paid_bills_value`.
8. THE Shift_Log SHALL store `variance` calculated as: `closing_float - expected_closing_float`.
9. IF `variance` is greater than zero, THE Shift_Log SHALL record it as a positive number indicating a cash surplus.
10. IF `variance` is less than zero, THE Shift_Log SHALL record it as a negative number indicating a cash shortage.
11. IF `variance` equals zero, THE Shift_Log SHALL record it as zero indicating full reconciliation.

---

### Requirement 2: Shift Breakdown Display in Close-Shift Modal

**User Story:** As a cashier, I want to see a live breakdown panel while filling in the close-shift form, so that I can verify all figures before submitting.

#### Acceptance Criteria

1. WHILE the Close_Shift_Modal is open, THE Close_Shift_Modal SHALL display a breakdown panel showing: Opening Float, Total Cash Sales, Total M-Pesa Sales, Total Card Sales, Total Other Sales, Total Sales, revenue by each stream, Credit Bills Created, Credit Bills Paid, Credit Bills Outstanding, Expected Closing Amount, Actual Cash Counted, and Variance.
2. WHEN the cashier enters or changes the Actual Cash Counted field, THE Close_Shift_Modal SHALL update the Variance display in real time without requiring form submission.
3. WHEN the Variance is positive, THE Close_Shift_Modal SHALL display the Variance value in blue with a surplus indicator label.
4. WHEN the Variance is negative, THE Close_Shift_Modal SHALL display the Variance value in red with a shortage indicator label.
5. WHEN the Variance is zero, THE Close_Shift_Modal SHALL display the Variance value in green with a "Fully Reconciled" label.
6. THE Close_Shift_Modal SHALL display the Expected Closing Amount formula as: `Opening Float + Cash Sales + Credit Payments Received`.
7. WHEN the cashier adds or removes a credit bill entry, THE Close_Shift_Modal SHALL recalculate and update Credit Bills Created, Credit Bills Outstanding, and Expected Closing Amount in real time.
8. WHEN the cashier adds or removes a paid bill entry, THE Close_Shift_Modal SHALL recalculate and update Credit Bills Paid, Credit Bills Outstanding, and Expected Closing Amount in real time.

---

### Requirement 3: Post-Close Shift Breakdown View

**User Story:** As a cashier, accountant, or auditor, I want to view the full breakdown of a closed shift, so that I can review and audit the financial details at any time after the shift is closed.

#### Acceptance Criteria

1. WHEN a user requests a closed Shift_Log by ID, THE System SHALL return all breakdown fields including payment method totals, revenue stream totals, credit bill totals, expected closing amount, actual closing float, and variance.
2. THE Shift_Breakdown_Report SHALL display all fields in a structured, read-only layout grouped by: Cash Reconciliation, Sales by Payment Method, Sales by Revenue Stream, Credit & Bills Summary, and Variance Analysis.
3. WHEN a Shift_Log has `status` of `closed`, `reconciled`, or `verified`, THE Shift_Breakdown_Report SHALL be accessible to the cashier who owns the shift, and to users with `accountant`, `branch_accountant`, `manager`, `auditor`, or `super_admin` roles.
4. IF a Shift_Log has `total_sales` of zero but has associated transactions in `cashier_shift_transactions`, THE System SHALL recompute the breakdown from transaction records before returning the response.
5. THE Shift_Breakdown_Report SHALL display the variance with a clear label: "Surplus", "Shortage", or "Balanced", corresponding to positive, negative, and zero variance respectively.

---

### Requirement 4: Variance Transparency

**User Story:** As an accountant or auditor, I want the variance to be calculated from a transparent, auditable formula, so that I can verify the cashier's figures independently.

#### Acceptance Criteria

1. THE System SHALL calculate variance using only the formula: `variance = closing_float - (opening_float + total_cash_sales + paid_bills_value)`.
2. THE System SHALL NOT use total revenue (all payment methods combined) as the basis for expected cash — only cash-affecting components SHALL be included.
3. WHEN the Shift_Breakdown_Report is displayed, THE Shift_Breakdown_Report SHALL show the variance formula components (Opening Float, Cash Sales, Credit Payments Received) alongside their values so the calculation is auditable.
4. THE Close_Shift_Modal SHALL use the same variance formula as the backend, so the figure shown to the cashier before submission matches the figure stored after submission.
5. IF the cashier-entered `closing_float` differs from the system-calculated `expected_closing_float` by any non-zero amount, THE Shift_Log SHALL record the variance and THE Shift_Breakdown_Report SHALL flag the shift as requiring review.

---

### Requirement 5: Credit Bills Outstanding Calculation

**User Story:** As a cashier and accountant, I want the outstanding credit balance to be clearly calculated and displayed, so that unpaid staff credit is tracked accurately across shifts.

#### Acceptance Criteria

1. THE System SHALL calculate `unpaid_bills_value` as: `credit_bills_taken - paid_bills_value` at the time of shift close.
2. WHEN `unpaid_bills_value` is greater than zero, THE Shift_Breakdown_Report SHALL display it prominently as "Outstanding Credit" with the amount.
3. WHEN `unpaid_bills_value` is zero, THE Shift_Breakdown_Report SHALL display "No Outstanding Credit" for that shift.
4. THE Shift_Breakdown_Report SHALL list individual credit bill entries (staff name, amount, timestamp) for both created and paid bills.
5. WHEN a credit bill is created during shift close, THE System SHALL create a corresponding record in `staff_credit_bills` with `status = 'pending'`.
6. WHEN a credit bill is marked as paid during shift close, THE System SHALL update the corresponding `staff_credit_bills` record to `status = 'paid_cash'` using FIFO settlement order.

---

### Requirement 6: Sales by Payment Method Summary

**User Story:** As a cashier and accountant, I want to see total sales broken down by payment method, so that I can reconcile each payment channel separately.

#### Acceptance Criteria

1. THE Shift_Breakdown_Report SHALL display `total_cash_sales`, `total_mpesa_sales`, `total_card_sales`, and `other_sales` as separate line items.
2. THE Shift_Breakdown_Report SHALL display `total_sales` as the sum of all payment method totals.
3. WHEN `total_cash_sales + total_mpesa_sales + total_card_sales + other_sales` does not equal `total_sales`, THE System SHALL log a reconciliation warning.
4. THE Shift_Breakdown_Report SHALL display each payment method total in KES with two decimal places.

---

### Requirement 7: Sales by Revenue Stream Summary

**User Story:** As a cashier and accountant, I want to see total sales broken down by revenue stream (department), so that I can verify each department's contribution to the shift total.

#### Acceptance Criteria

1. THE Shift_Breakdown_Report SHALL display revenue totals for each active revenue stream: Restaurant, Bar, Rooms, Conference, Swimming Pool, Pool Tokens, and Other.
2. WHERE a revenue stream is marked as N/A by the cashier, THE Shift_Breakdown_Report SHALL display that stream as "N/A" rather than zero.
3. THE Shift_Breakdown_Report SHALL display a subtotal of all non-N/A revenue streams.
4. WHEN the sum of revenue stream totals does not match `total_sales`, THE Shift_Breakdown_Report SHALL display both figures and highlight the discrepancy for accountant review.

---

### Requirement 8: Data Consistency Between Frontend and Backend

**User Story:** As a system administrator, I want the frontend breakdown calculations to match the backend stored values exactly, so that cashiers are not surprised by different figures after submission.

#### Acceptance Criteria

1. THE Close_Shift_Modal SHALL use the formula `expected_closing_float = opening_float + total_cash_sales + paid_bills_value` — identical to the backend formula in `cashier-shifts.controller.ts`.
2. THE Close_Shift_Modal SHALL derive `total_cash_sales` from the shift's recorded `total_cash_sales` field (fetched from the active shift), not from the sum of revenue stream inputs.
3. WHEN the shift data is fetched for the Close_Shift_Modal, THE System SHALL include `total_cash_sales`, `total_mpesa_sales`, `total_card_sales`, and `transaction_count` in the response.
4. THE System SHALL ensure that the variance value displayed in the Close_Shift_Modal before submission is within KES 0.01 of the variance value stored in the Shift_Log after submission.
