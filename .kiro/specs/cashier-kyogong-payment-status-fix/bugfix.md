# Bugfix Requirements Document

## Introduction

This document addresses a critical bug in the cashier payment processing system where Kyogong bills (e.g., SPA-20260220-5067) do not update their payment status in the UI after successful payment processing. The backend correctly updates the database, but the frontend fails to reflect these changes, causing bills to remain in the "Unpaid Bills & Reservations" section with "Payment Pending" status even after payment completion. This creates confusion for cashiers and risks double-charging customers.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a cashier processes a payment for a Kyogong bill using CASH/MPESA/CARD THEN the bill continues to display "Payment Pending" status in the UI despite successful backend processing

1.2 WHEN a cashier completes payment for a Kyogong bill THEN the bill remains visible in the "Unpaid Bills & Reservations" section instead of being removed

1.3 WHEN the frontend calls `fetchUnpaidBills()` immediately after payment processing THEN the bill still appears in the unpaid list due to race condition or stale data

1.4 WHEN a cashier manually refreshes the unpaid bills list after payment THEN the paid bill still appears in the list indicating the UI is not properly synchronized with database state

### Expected Behavior (Correct)

2.1 WHEN a cashier processes a payment for a Kyogong bill using CASH/MPESA/CARD THEN the bill SHALL immediately update to show "Paid" status in the UI

2.2 WHEN a cashier completes payment for a Kyogong bill THEN the bill SHALL disappear from the "Unpaid Bills & Reservations" section automatically

2.3 WHEN the frontend refreshes bill data after payment processing THEN the bill SHALL not appear in the unpaid list because the database `payment_method` has been updated from 'BILL' to the actual payment method

2.4 WHEN a cashier manually refreshes the unpaid bills list after payment THEN the paid bill SHALL not appear in the list, confirming proper synchronization

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a cashier processes payment for non-Kyogong bills (restaurant bills, room bills) THEN the system SHALL CONTINUE TO update payment status correctly as it currently does

3.2 WHEN the backend receives a payment request for a Kyogong bill THEN the system SHALL CONTINUE TO correctly update the `shift_transactions` table with payment details, update `payment_method` from 'BILL' to 'CASH'/'MPESA'/'CARD', and record the transaction in `cashier_transactions`

3.3 WHEN the backend query for unpaid bills filters by `.eq('payment_method', 'BILL')` THEN the system SHALL CONTINUE TO use this correct filtering logic

3.4 WHEN a bill has not been paid yet THEN the system SHALL CONTINUE TO display it in the "Unpaid Bills & Reservations" section with "Payment Pending" status

3.5 WHEN multiple cashiers are processing payments simultaneously THEN the system SHALL CONTINUE TO handle concurrent transactions correctly without data corruption
