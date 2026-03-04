# Requirements Document

## Introduction

This document specifies requirements for a real-time cash float tracking system in the Kyogong cashier interface. The system enables cashiers to monitor their cash drawer balance throughout their shift, automatically updating the float as cash payments are received and change is given. This provides transparency and accountability for cash handling at all Kyogong sales points (Spa, Reception, Executive Bar, Sports Bar).

## Glossary

- **Cash_Float**: The total amount of physical cash currently in the cashier's drawer
- **Opening_Float**: The initial cash amount placed in the drawer when a shift begins
- **Closing_Float**: The actual cash amount counted in the drawer when a shift ends
- **Expected_Closing_Cash**: The calculated amount of cash that should be in the drawer at shift end (Opening_Float + Total_Cash_In - Total_Change_Given)
- **Cash_Variance**: The difference between Expected_Closing_Cash and Closing_Float
- **Cashier_Shift**: A work period for a cashier at a specific sales point with defined start and end times
- **Sales_Point**: A location where transactions occur (Spa, Reception, Executive Bar, Sports Bar)
- **Cash_Transaction**: A payment transaction where the customer pays with physical cash
- **Change_Amount**: The difference between cash received and the bill total, returned to the customer
- **Float_Display**: The UI component showing the current cash float amount
- **Shift_Summary**: A report showing opening float, all transactions, and expected closing cash

## Requirements

### Requirement 1: Display Current Cash Float

**User Story:** As a cashier, I want to see the current cash float amount when I select "Cash" as the payment method, so that I know how much cash is currently in my drawer.

#### Acceptance Criteria

1. WHEN the cashier selects "Cash" as the payment method, THE Float_Display SHALL show the current Cash_Float amount
2. THE Float_Display SHALL show the Opening_Float amount at the start of the shift
3. THE Float_Display SHALL be prominently visible in the payment interface
4. THE Float_Display SHALL format amounts in KES currency with proper thousand separators
5. THE Float_Display SHALL update within 500ms of any cash transaction completion

### Requirement 2: Update Float on Cash Receipt

**User Story:** As a cashier, I want the cash float to increase when I receive cash payment, so that the system accurately reflects the cash in my drawer.

#### Acceptance Criteria

1. WHEN a Cash_Transaction is completed with cash received, THE System SHALL increase Cash_Float by the amount received
2. THE System SHALL record the cash received amount in the transaction record
3. THE System SHALL update the total_cash_in field in the Cashier_Shift record
4. WHEN multiple cash payments occur, THE System SHALL accumulate all cash received amounts
5. THE System SHALL persist the updated Cash_Float to the database before displaying the updated amount

### Requirement 3: Update Float on Change Given

**User Story:** As a cashier, I want the cash float to decrease when I give change, so that the system accurately reflects the cash remaining in my drawer.

#### Acceptance Criteria

1. WHEN change is given in a Cash_Transaction, THE System SHALL decrease Cash_Float by the Change_Amount
2. THE System SHALL calculate Change_Amount as (cash received - bill total)
3. WHEN Change_Amount is zero, THE System SHALL not decrease Cash_Float
4. THE System SHALL record the Change_Amount in the transaction record
5. THE System SHALL validate that Cash_Float remains non-negative after change is given

### Requirement 4: Calculate Net Float Change

**User Story:** As a cashier, I want the system to automatically calculate the net effect of each transaction, so that my cash float is always accurate.

#### Acceptance Criteria

1. FOR ALL Cash_Transactions, THE System SHALL calculate net change as (cash received - Change_Amount)
2. THE System SHALL update Cash_Float by adding the net change amount
3. WHEN cash received equals bill total, THE System SHALL increase Cash_Float by the bill total
4. WHEN cash received exceeds bill total, THE System SHALL increase Cash_Float by the bill total only
5. THE System SHALL apply float updates atomically to prevent race conditions

### Requirement 5: Track Expected Closing Cash

**User Story:** As a cashier, I want to see the expected closing cash amount, so that I know how much cash should be in my drawer at shift end.

#### Acceptance Criteria

1. THE System SHALL calculate Expected_Closing_Cash as (Opening_Float + sum of all net cash changes)
2. THE System SHALL update Expected_Closing_Cash after each Cash_Transaction
3. THE System SHALL store Expected_Closing_Cash in the expected_cash field of Cashier_Shift
4. WHEN the shift is active, THE System SHALL display Expected_Closing_Cash in the cashier interface
5. THE System SHALL maintain Expected_Closing_Cash accuracy across page refreshes

### Requirement 6: Initialize Opening Float

**User Story:** As a cashier, I want to set my opening float when starting a shift, so that the system has a baseline for tracking cash.

#### Acceptance Criteria

1. WHEN a Cashier_Shift is opened, THE System SHALL prompt for the Opening_Float amount
2. THE System SHALL store Opening_Float in the opening_float field of Cashier_Shift
3. THE System SHALL initialize Cash_Float to equal Opening_Float at shift start
4. THE System SHALL validate that Opening_Float is a positive number
5. THE System SHALL prevent shift opening if Opening_Float is not provided

### Requirement 7: Display Real-Time Float Updates

**User Story:** As a cashier, I want to see my cash float update immediately after each transaction, so that I always know my current cash position.

#### Acceptance Criteria

1. WHEN a Cash_Transaction completes, THE Float_Display SHALL update within 500ms
2. THE Float_Display SHALL show a visual indicator during the update process
3. WHEN the float update fails, THE System SHALL display an error message and retain the previous float value
4. THE Float_Display SHALL refresh automatically without requiring page reload
5. THE System SHALL use optimistic UI updates with rollback on failure

### Requirement 8: Calculate Cash Variance at Shift Close

**User Story:** As a cashier, I want the system to calculate the variance between expected and actual cash, so that I can identify discrepancies.

#### Acceptance Criteria

1. WHEN closing a Cashier_Shift, THE System SHALL prompt for the actual Closing_Float count
2. THE System SHALL calculate Cash_Variance as (Closing_Float - Expected_Closing_Cash)
3. THE System SHALL store Cash_Variance in the cash_variance field of Cashier_Shift
4. WHEN Cash_Variance is non-zero, THE System SHALL highlight the variance in the shift summary
5. THE System SHALL allow shift closure regardless of variance amount

### Requirement 9: Provide Shift Summary Report

**User Story:** As a cashier, I want to see a summary of my shift including all cash movements, so that I can verify my cash handling before closing.

#### Acceptance Criteria

1. WHEN viewing the Shift_Summary, THE System SHALL display Opening_Float
2. THE Shift_Summary SHALL list all Cash_Transactions with amounts received and change given
3. THE Shift_Summary SHALL display total cash received during the shift
4. THE Shift_Summary SHALL display total change given during the shift
5. THE Shift_Summary SHALL display Expected_Closing_Cash
6. THE Shift_Summary SHALL calculate and display the net cash change (total received - total change)

### Requirement 10: Handle Multiple Payment Methods

**User Story:** As a cashier, I want the cash float to only update for cash transactions, so that other payment methods don't affect my cash drawer balance.

#### Acceptance Criteria

1. WHEN a transaction is paid by M-Pesa, THE System SHALL not update Cash_Float
2. WHEN a transaction is paid by card, THE System SHALL not update Cash_Float
3. WHEN a transaction is paid by bank transfer, THE System SHALL not update Cash_Float
4. WHEN a transaction uses split payment with cash, THE System SHALL update Cash_Float only by the cash portion
5. THE System SHALL track non-cash payments separately from Cash_Float

### Requirement 11: Persist Float State Across Sessions

**User Story:** As a cashier, I want my cash float to persist if I refresh the page or log out temporarily, so that I don't lose track of my cash position.

#### Acceptance Criteria

1. WHEN the cashier refreshes the page, THE System SHALL retrieve the current Cash_Float from the database
2. WHEN the cashier logs out and back in during an active shift, THE System SHALL restore the Cash_Float state
3. THE System SHALL store Cash_Float updates in the Cashier_Shift record
4. WHEN the database is unavailable, THE System SHALL display the last known Cash_Float with a warning indicator
5. THE System SHALL synchronize Cash_Float state across multiple browser tabs for the same shift

### Requirement 12: Validate Cash Transaction Inputs

**User Story:** As a cashier, I want the system to validate cash amounts I enter, so that I don't make data entry errors that affect my float.

#### Acceptance Criteria

1. WHEN entering cash received amount, THE System SHALL validate it is a positive number
2. WHEN cash received is less than bill total, THE System SHALL display an error and prevent transaction completion
3. WHEN Change_Amount is calculated as negative, THE System SHALL display an error
4. THE System SHALL validate that all cash amounts have at most 2 decimal places
5. THE System SHALL prevent transaction completion if validation fails

### Requirement 13: Support Float Adjustments

**User Story:** As a supervisor, I want to make manual adjustments to the cash float when necessary, so that I can correct errors or account for legitimate cash movements.

#### Acceptance Criteria

1. WHERE the user has supervisor privileges, THE System SHALL provide a float adjustment interface
2. WHEN a float adjustment is made, THE System SHALL require a reason for the adjustment
3. THE System SHALL record all float adjustments with timestamp, amount, reason, and user
4. THE System SHALL update Cash_Float and Expected_Closing_Cash to reflect the adjustment
5. THE System SHALL display adjustment history in the Shift_Summary

### Requirement 14: Handle Concurrent Transactions

**User Story:** As a system administrator, I want the cash float to remain accurate even when multiple transactions are processed quickly, so that race conditions don't cause data corruption.

#### Acceptance Criteria

1. WHEN multiple Cash_Transactions are processed concurrently, THE System SHALL use database transactions to ensure atomicity
2. THE System SHALL use row-level locking on the Cashier_Shift record during float updates
3. WHEN a float update conflict occurs, THE System SHALL retry the update up to 3 times
4. IF all retries fail, THE System SHALL log the error and notify the cashier
5. THE System SHALL ensure that the final Cash_Float reflects all completed transactions

### Requirement 15: Display Float History

**User Story:** As a cashier, I want to see a history of how my cash float changed throughout the shift, so that I can trace any discrepancies.

#### Acceptance Criteria

1. THE System SHALL maintain a chronological log of all Cash_Float changes
2. WHEN viewing float history, THE System SHALL display timestamp, transaction reference, amount change, and resulting float
3. THE System SHALL include both automatic transaction updates and manual adjustments in the history
4. THE System SHALL allow filtering float history by time range
5. THE System SHALL export float history to CSV format for record keeping
