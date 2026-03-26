# Implementation Tasks

## Shift Closing Breakdown

- [x] 1. Fix backend variance formula in `closeShift`
  - In `backend/src/controllers/cashier-shifts.controller.ts`, the `closeShift` function currently computes `expectedClosingFloat` using `total_cash_sales` from the RPC summary. Ensure it uses the strict formula: `opening_float + total_cash_sales + paid_bills_value` (not total revenue).
  - Compute `unpaid_bills_value` server-side as `credit_bills_taken - paid_bills_value` instead of trusting the client-sent value.
  - Log a reconciliation warning when `total_cash_sales + total_mpesa_sales + total_card_sales + other_revenue` does not equal `total_sales`.
  - _Requirements: 1.6, 1.7, 1.8, 4.1, 4.2, 6.3_

- [x] 2. Expose payment method totals in `getShiftLog` and `getShiftLogs`
  - In `backend/src/controllers/cashier-shifts.controller.ts`, ensure both `getShiftLog` (single) and `getShiftLogs` (list) always return `total_cash_sales`, `total_mpesa_sales`, `total_card_sales`, `transaction_count`, `expected_closing_float`, and `variance` in the response.
  - When the RPC returns `total_sales > 0`, also populate the per-method breakdown from the RPC result.
  - _Requirements: 3.1, 8.3_

- [x] 3. Add live breakdown panel to `close-shift-modal.tsx`
  - In `frontend/src/components/cashier/close-shift-modal.tsx`, add a "Shift Breakdown" summary section to the left sidebar (below the existing Expected Cash Flow and Variance blocks) that shows:
    - Opening Float (read-only from `currentShift.opening_float`)
    - Cash Sales / M-Pesa Sales / Card Sales / Other Sales (read-only from `currentShift`)
    - Total Sales
    - Revenue by stream (live from form inputs)
    - Credit Bills Created / Paid / Outstanding (live from form state)
    - Expected Closing Amount with formula label: `Opening Float + Cash Sales + Credit Payments Received`
    - Actual Cash Counted (mirrors the closing_float input)
    - Variance with colour-coded label
  - _Requirements: 2.1, 2.6_

- [x] 4. Fix variance formula in `close-shift-modal.tsx` to match backend
  - The current modal computes `expectedClosing = opening_float + totalRevenue + paid_bills_value`, which is wrong — it uses total revenue instead of cash-only sales.
  - Change to: `expectedClosing = (currentShift?.opening_float || 0) + (currentShift?.total_cash_sales || 0) + (formData.paid_bills_value || 0)`.
  - Derive `total_cash_sales` from `currentShift.total_cash_sales` (fetched from the active shift API response), not from revenue stream inputs.
  - _Requirements: 2.2, 4.4, 8.1, 8.2_

- [x] 5. Add real-time variance colour coding to `close-shift-modal.tsx`
  - When variance > 0: display in blue with label "Surplus".
  - When variance < 0: display in red with label "Shortage".
  - When variance === 0: display in green with label "Fully Reconciled".
  - Update on every keystroke in the closing_float input without form submission.
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 6. Add `ShiftBreakdownReport` component for post-close view
  - Create `frontend/src/components/cashier/shift-breakdown-report.tsx`.
  - Accept a `shift` prop (full `cashier_shift_logs` row) and render a read-only structured report grouped into five sections:
    1. **Cash Reconciliation** — Opening Float, Expected Closing, Actual Closing, Variance (with Surplus / Shortage / Balanced label)
    2. **Sales by Payment Method** — Cash, M-Pesa, Card, Other, Total
    3. **Sales by Revenue Stream** — each stream with N/A handling, subtotal, and discrepancy flag if stream sum ≠ total_sales
    4. **Credit & Bills Summary** — Created, Paid, Outstanding; individual bill entries (staff name, amount, time)
    5. **Variance Analysis** — formula components displayed as: `Opening Float (X) + Cash Sales (Y) + Credit Payments (Z) = Expected (W)`, then `Actual (A) − Expected (W) = Variance (V)`
  - _Requirements: 3.2, 3.5, 4.3, 4.5, 5.2, 5.3, 5.4, 6.1, 6.4, 7.1, 7.2, 7.3, 7.4_

- [x] 7. Integrate `ShiftBreakdownReport` into the cashier logbook shift history
  - In `frontend/src/components/cashier/cashier-logbook.tsx`, make each closed shift card expandable.
  - When a shift card is clicked/expanded, render `<ShiftBreakdownReport shift={shift} />` inline below the card summary row.
  - Collapsed state shows: shift number, date, status badge, total sales, variance.
  - _Requirements: 3.1, 3.3_

- [x] 8. Integrate `ShiftBreakdownReport` into the accountant/auditor shift review panel
  - In `frontend/src/components/cashier/shift-review-panel.tsx`, replace or augment the existing shift detail view with `<ShiftBreakdownReport shift={shift} />`.
  - Ensure the component is accessible to roles: `accountant`, `branch_accountant`, `manager`, `auditor`, `super_admin`.
  - _Requirements: 3.3_
