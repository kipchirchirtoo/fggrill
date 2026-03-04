# Implementation Plan: Kyogong Cash Float Tracking System

## Overview

This implementation plan breaks down the real-time cash float tracking system into discrete, manageable coding tasks. The system extends the existing Kyogong cashier infrastructure to provide automatic cash drawer balance tracking, variance calculation, and comprehensive audit trails.

The implementation follows a bottom-up approach: database schema → backend services → API controllers → frontend components → integration and testing.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create database migration for enhanced cashier_shifts table
    - Add columns: current_float, expected_cash, total_change_given, float_version, last_float_update
    - Ensure backward compatibility with existing shifts
    - Add indexes for performance optimization
    - _Requirements: 2.3, 5.3, 11.3, 14.2_
  
  - [x] 1.2 Create database migration for float_history table
    - Create table with all required fields (shift_id, timestamp, change_type, amount_change, resulting_float, transaction_id, adjustment_reason, performed_by)
    - Add foreign key constraints to cashier_shifts, shift_transactions, and users tables
    - Create indexes on shift_id, timestamp, and change_type for query performance
    - Add CHECK constraint for change_type enum values
    - _Requirements: 13.3, 15.1, 15.2_
  
  - [ ]* 1.3 Write property test for database schema constraints
    - **Property 4: Float Non-Negativity Invariant**
    - **Validates: Requirements 3.5**
    - Test that current_float cannot be negative through database constraints or application logic
    - Test that opening_float must be positive

- [x] 2. Backend services layer
  - [x] 2.1 Create Float History Service
    - Implement recordFloatChange method to create history entries
    - Implement getHistory method with time range and change type filters
    - Handle database errors gracefully with proper error messages
    - _Requirements: 13.3, 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 2.2 Write unit tests for Float History Service
    - Test recordFloatChange creates correct history entry
    - Test getHistory returns entries in chronological order
    - Test getHistory filters by time range correctly
    - Test getHistory filters by change type correctly
    - Test error handling for database failures
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [ ]* 2.3 Write property test for float history completeness
    - **Property 15: Float History Completeness**
    - **Validates: Requirements 15.1, 15.2, 15.3**
    - Test that every float change creates a history entry with all required fields

- [-] 3. Float Tracking Controller
  - [x] 3.1 Create Float Tracking Controller with getCurrentFloat endpoint
    - Implement GET /api/kyogong/shifts/:shift_id/float endpoint
    - Return current_float, opening_float, expected_cash, last_updated
    - Handle shift not found error (404)
    - Handle closed shift scenario
    - _Requirements: 1.1, 1.2, 5.4, 11.1_
  
  - [x] 3.2 Implement updateFloatOnTransaction method
    - Calculate net cash change (cash received - change given)
    - Update current_float and expected_cash atomically using database transaction
    - Implement optimistic locking with float_version check
    - Retry logic for version conflicts (up to 3 attempts with exponential backoff)
    - Call Float History Service to record the change
    - Validate float remains non-negative
    - _Requirements: 2.1, 2.5, 3.1, 3.5, 4.2, 4.5, 5.2, 14.1, 14.2, 14.3_
  
  - [ ]* 3.3 Write property tests for float update logic
    - **Property 1: Net Cash Change Calculation**
    - **Validates: Requirements 3.2, 4.1, 4.4**
    - Test net change = cash received - max(0, cash received - bill total)
    
    - **Property 2: Float Update Reflects Net Change**
    - **Validates: Requirements 2.1, 4.2**
    - Test current_float after = current_float before + net change
  
  - [x] 3.4 Implement adjustFloat endpoint for manual adjustments
    - Implement POST /api/kyogong/shifts/:shift_id/float/adjust endpoint
    - Validate user has supervisor role (403 if not)
    - Require adjustment reason (400 if missing)
    - Update current_float and expected_cash by adjustment amount
    - Record adjustment in float history with reason and user
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [ ]* 3.5 Write unit tests for adjustFloat endpoint
    - Test supervisor can make adjustment
    - Test non-supervisor receives 403 error
    - Test adjustment without reason receives 400 error
    - Test positive adjustment increases float
    - Test negative adjustment decreases float
    - Test adjustment creates history entry
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [ ]* 3.6 Write property test for adjustment recording
    - **Property 13: Adjustment Recording Completeness**
    - **Validates: Requirements 13.2, 13.3, 13.4**
    - Test every adjustment creates history entry with all required fields
  
  - [x] 3.7 Implement getFloatHistory endpoint
    - Implement GET /api/kyogong/shifts/:shift_id/float/history endpoint
    - Support query parameters for startTime, endTime, changeType filters
    - Return chronological list of float changes
    - _Requirements: 15.1, 15.2, 15.4_
  
  - [x] 3.8 Implement exportFloatHistory endpoint
    - Implement GET /api/kyogong/shifts/:shift_id/float/history/export endpoint
    - Generate CSV with columns: timestamp, change_type, amount_change, resulting_float, transaction_ref, reason, performed_by
    - Set proper Content-Type and Content-Disposition headers for download
    - _Requirements: 15.5_
  
  - [ ]* 3.9 Write property test for CSV export round-trip
    - **Property 16: Float History Export Round-Trip**
    - **Validates: Requirements 15.5**
    - Test that exporting and parsing CSV preserves all essential data

- [ ] 4. Checkpoint - Backend services complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [-] 5. Enhanced Transaction Controller integration
  - [x] 5.1 Modify createTransaction to update float for cash payments
    - After transaction is saved, check if payment_method is 'CASH'
    - Calculate cash received and change given from transaction data
    - Call updateFloatOnTransaction with shift_id, cash_received, change_given, transaction_id
    - Handle float update errors by rolling back transaction
    - Return updated float in transaction response
    - _Requirements: 2.1, 2.2, 3.1, 3.4, 4.2, 17_
  
  - [x] 5.2 Ensure non-cash payments don't update float
    - Verify M-Pesa, card, and bank transfer payments skip float update
    - For split payments, calculate only the cash portion
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 5.3 Write property test for payment method isolation
    - **Property 10: Non-Cash Payment Float Isolation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    - Test that non-cash payments don't change float
    - Test that split payments only update float by cash portion
  
  - [ ]* 5.4 Write integration tests for transaction-float coupling
    - Test cash transaction creates float history entry
    - Test cash transaction updates current_float correctly
    - Test cash transaction updates expected_cash correctly
    - Test M-Pesa transaction doesn't update float
    - Test transaction rollback on float update failure
    - _Requirements: 2.1, 2.5, 5.2, 10.1_
  
  - [ ]* 5.5 Write property test for cash accumulation
    - **Property 3: Cash Accumulation Across Transactions**
    - **Validates: Requirements 2.3, 2.4, 14.5**
    - Test that processing multiple transactions results in correct cumulative float

- [-] 6. Shift management integration
  - [x] 6.1 Modify shift opening to initialize float
    - Validate opening_float is provided and positive (400 if not)
    - Set current_float = opening_float
    - Set expected_cash = opening_float
    - Set float_version = 0
    - Record OPENING entry in float history
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 6.2 Write property test for opening float initialization
    - **Property 6: Opening Float Initialization**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - Test that new shift has current_float = opening_float
    - Test that opening_float must be positive
  
  - [ ] 6.3 Modify shift closing to calculate variance
    - Prompt for closing_float (actual counted cash)
    - Calculate cash_variance = closing_float - expected_cash
    - Store variance in cashier_shifts record
    - Allow closure regardless of variance amount
    - Record CLOSING entry in float history
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [ ]* 6.4 Write property tests for shift closure
    - **Property 7: Cash Variance Calculation**
    - **Validates: Requirements 8.2, 8.3**
    - Test variance = closing_float - expected_cash
    
    - **Property 8: Shift Closure Independence from Variance**
    - **Validates: Requirements 8.5**
    - Test that shift closes successfully with any variance amount
  
  - [ ]* 6.5 Write unit tests for shift lifecycle
    - Test shift opening with valid opening_float succeeds
    - Test shift opening without opening_float fails with 400
    - Test shift opening with negative opening_float fails with 400
    - Test shift closing calculates variance correctly
    - Test shift closing with large variance succeeds
    - _Requirements: 6.1, 6.4, 6.5, 8.1, 8.5_

- [x] 7. API routes registration
  - [x] 7.1 Register float tracking routes in Kyogong router
    - Add GET /api/kyogong/shifts/:shift_id/float route
    - Add POST /api/kyogong/shifts/:shift_id/float/adjust route
    - Add GET /api/kyogong/shifts/:shift_id/float/history route
    - Add GET /api/kyogong/shifts/:shift_id/float/history/export route
    - Apply authentication middleware to all routes
    - Apply supervisor role check to adjust route
    - _Requirements: 1.1, 13.1, 15.1, 15.5_

- [ ] 8. Checkpoint - Backend integration complete
  - Ensure all backend integration tests pass, ask the user if questions arise.

- [x] 9. Frontend Float Display Component
  - [x] 9.1 Create FloatDisplay component
    - Accept shiftId and refreshTrigger props
    - Fetch current float data from GET /api/kyogong/shifts/:shift_id/float
    - Display current_float with KES currency formatting and thousand separators
    - Display opening_float and expected_closing_cash
    - Show loading indicator during fetch
    - Show error state with retry button on failure
    - Auto-refresh every 5 seconds or when refreshTrigger changes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.3, 7.4_
  
  - [ ]* 9.2 Write property test for currency formatting
    - **Property 18: Currency Formatting Consistency**
    - **Validates: Requirements 1.4**
    - Test that all amounts display with KES prefix and thousand separators
  
  - [ ]* 9.3 Write unit tests for FloatDisplay component
    - Test displays loading state initially
    - Test displays float data after successful fetch
    - Test displays error state on fetch failure
    - Test retry button refetches data
    - Test auto-refresh triggers fetch every 5 seconds
    - Test formats currency with KES and thousand separators
    - _Requirements: 1.1, 1.3, 1.4, 7.1, 7.3, 7.4_

- [x] 10. Frontend Payment Form Enhancement
  - [x] 10.1 Integrate FloatDisplay into payment form
    - Show FloatDisplay component when "Cash" payment method is selected
    - Hide FloatDisplay for non-cash payment methods
    - Pass current shift_id to FloatDisplay
    - _Requirements: 1.1, 10.1, 10.2, 10.3_
  
  - [x] 10.2 Add real-time change calculation
    - Calculate change = cash_received - bill_total
    - Display change amount prominently
    - Update change display as user types cash_received
    - _Requirements: 3.2_
  
  - [x] 10.3 Add cash payment validation
    - Validate cash_received is a positive number
    - Validate cash_received >= bill_total (show error if less)
    - Validate cash amounts have at most 2 decimal places
    - Prevent transaction submission if validation fails
    - _Requirements: 12.1, 12.2, 12.4, 12.5_
  
  - [ ]* 10.4 Write property test for cash validation
    - **Property 12: Cash Input Validation**
    - **Validates: Requirements 12.1, 12.2, 12.4, 12.5**
    - Test that invalid inputs are rejected
  
  - [x] 10.5 Implement optimistic float update
    - After transaction submission, optimistically update FloatDisplay
    - Increment refreshTrigger to force FloatDisplay refresh
    - On transaction error, rollback optimistic update
    - _Requirements: 7.1, 7.5_
  
  - [ ]* 10.6 Write unit tests for payment form enhancements
    - Test FloatDisplay shown when Cash selected
    - Test FloatDisplay hidden when M-Pesa selected
    - Test change calculation updates in real-time
    - Test validation prevents underpayment
    - Test validation prevents invalid decimal places
    - Test optimistic update on successful transaction
    - Test rollback on transaction failure
    - _Requirements: 1.1, 3.2, 7.5, 10.1, 12.1, 12.2_

- [ ] 11. Frontend Shift Summary Component
  - [ ] 11.1 Enhance ShiftSummary to display float information
    - Display opening_float prominently
    - Display total_cash_in (sum of all cash received)
    - Display total_change_given
    - Display expected_closing_cash with calculation breakdown
    - Highlight cash_variance if non-zero (red for negative, yellow for positive)
    - Add "View Float History" button linking to float history view
    - Add "Export Float History" button to download CSV
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 8.4, 15.5_
  
  - [ ]* 11.2 Write property test for summary calculations
    - **Property 9: Summary Calculations Accuracy**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.6**
    - Test that displayed totals match sum of transactions
  
  - [ ]* 11.3 Write unit tests for ShiftSummary enhancements
    - Test displays all required float fields
    - Test highlights variance when non-zero
    - Test "View Float History" button navigates correctly
    - Test "Export Float History" button downloads CSV
    - Test calculation breakdown shows correct formula
    - _Requirements: 9.1, 9.2, 9.5, 8.4, 15.5_

- [ ] 12. Frontend Float Adjustment Modal
  - [ ] 12.1 Create FloatAdjustmentModal component
    - Accept shiftId, currentFloat, onAdjustmentComplete props
    - Input field for adjustment amount (positive or negative)
    - Required text area for adjustment reason
    - Preview of resulting float after adjustment
    - Confirmation dialog before submitting
    - Call POST /api/kyogong/shifts/:shift_id/float/adjust on submit
    - Handle 403 error (non-supervisor) with clear message
    - Handle 400 error (missing reason) with validation message
    - Call onAdjustmentComplete callback on success
    - _Requirements: 13.1, 13.2_
  
  - [ ]* 12.2 Write unit tests for FloatAdjustmentModal
    - Test requires reason before submission
    - Test shows preview of resulting float
    - Test displays 403 error for non-supervisor
    - Test displays 400 error for missing reason
    - Test calls onAdjustmentComplete on success
    - Test confirmation dialog appears before submit
    - _Requirements: 13.1, 13.2_

- [ ] 13. Frontend Float History View
  - [ ] 13.1 Create FloatHistoryView component
    - Accept shiftId prop
    - Fetch float history from GET /api/kyogong/shifts/:shift_id/float/history
    - Display entries in chronological order (newest first)
    - Color-code entries: green for increases, red for decreases, blue for adjustments
    - Show timestamp, change_type, amount_change, resulting_float for each entry
    - Show transaction_ref as clickable link (if present)
    - Show adjustment reason and performed_by for adjustments
    - Add filter controls for time range and change_type
    - Add "Export to CSV" button
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 13.5_
  
  - [ ]* 13.2 Write property test for adjustment history inclusion
    - **Property 14: Adjustment History Inclusion**
    - **Validates: Requirements 13.5**
    - Test that shifts with adjustments include adjustment records in history
  
  - [ ]* 13.3 Write unit tests for FloatHistoryView
    - Test displays entries in chronological order
    - Test color-codes entries correctly
    - Test transaction_ref is clickable link
    - Test shows adjustment reason for adjustments
    - Test filters by time range correctly
    - Test filters by change_type correctly
    - Test export button downloads CSV
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 14. Checkpoint - Frontend components complete
  - Ensure all frontend component tests pass, ask the user if questions arise.

- [ ] 15. Integration and wiring
  - [x] 15.1 Wire FloatDisplay into cashier payment interface
    - Import and render FloatDisplay in payment form
    - Pass active shift_id from context/state
    - Ensure FloatDisplay updates after each transaction
    - _Requirements: 1.1, 7.1_
  
  - [ ] 15.2 Wire FloatAdjustmentModal into supervisor interface
    - Add "Adjust Float" button to shift management UI (supervisor only)
    - Open FloatAdjustmentModal on button click
    - Refresh shift data after adjustment completes
    - _Requirements: 13.1_
  
  - [ ] 15.3 Wire FloatHistoryView into shift summary
    - Add route for float history view page
    - Link "View Float History" button in ShiftSummary to history page
    - Pass shift_id to FloatHistoryView component
    - _Requirements: 15.1_
  
  - [ ] 15.4 Add float persistence across page refreshes
    - Ensure getCurrentFloat is called on page load if shift is active
    - Restore float state from database on browser refresh
    - Show warning indicator if database is unavailable
    - _Requirements: 11.1, 11.2, 11.4_
  
  - [ ]* 15.5 Write property test for float persistence
    - **Property 11: Float Persistence Round-Trip**
    - **Validates: Requirements 11.1, 11.2, 11.3, 5.5**
    - Test that retrieving shift data returns last persisted float value
  
  - [ ]* 15.6 Write end-to-end integration tests
    - Test complete shift lifecycle: open → transactions → close
    - Test cash transaction updates float and creates history
    - Test supervisor adjustment updates float and creates history
    - Test float persists across page refresh
    - Test variance calculation at shift close
    - Test float history export contains all entries
    - _Requirements: 2.1, 5.2, 8.2, 11.1, 13.3, 15.5_

- [ ] 16. Error handling and edge cases
  - [ ] 16.1 Implement comprehensive error handling
    - Add error boundaries for frontend components
    - Implement retry logic for failed float updates (up to 3 attempts)
    - Display user-friendly error messages for all error scenarios
    - Log all errors with context (user, shift, transaction)
    - _Requirements: 7.3, 14.3, 14.4_
  
  - [ ] 16.2 Handle edge cases
    - Exact payment (no change): Ensure float increases by bill total only
    - Concurrent transactions: Verify optimistic locking prevents lost updates
    - Shift not found: Return 404 with clear message
    - Closed shift: Prevent float updates with appropriate error
    - Negative float scenario: Prevent transaction or require supervisor adjustment
    - _Requirements: 3.5, 4.3, 14.1, 14.2_
  
  - [ ]* 16.3 Write unit tests for error scenarios
    - Test underpayment rejected with 400 error
    - Test invalid decimal places rejected
    - Test concurrent update retry logic
    - Test database error triggers rollback
    - Test non-supervisor adjustment returns 403
    - Test adjustment without reason returns 400
    - Test negative float prevented
    - _Requirements: 3.5, 12.2, 12.5, 13.1, 13.2, 14.3_

- [ ] 17. Final checkpoint - Complete system integration
  - Ensure all tests pass (unit, property, integration, end-to-end)
  - Verify all 15 requirements are covered by implementation
  - Verify all 18 correctness properties are tested
  - Ask the user if questions arise or if ready for deployment.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a bottom-up approach to minimize integration issues
- Checkpoints ensure incremental validation and allow for course correction
- All monetary amounts use 2 decimal places for KES currency
- Optimistic locking with float_version prevents race conditions in concurrent scenarios
- Float history provides complete audit trail for accountability and troubleshooting
