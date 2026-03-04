# Implementation Plan: Stock-Take Auditor Submission Workflow

## Overview

This implementation plan covers the complete stock-take auditor submission workflow feature, including database migrations, backend API endpoints, notification service integration, frontend UI enhancements, and comprehensive testing. The implementation follows an incremental approach where each task builds on previous work, with checkpoints to ensure quality and correctness.

## Tasks

- [x] 1. Database schema setup and migrations
  - [x] 1.1 Create stock_take_audit_log table with indexes
    - Create new table with all required columns (id, stock_take_id, action, previous_status, new_status, user_id, user_role, event_type, event_data, notification_id, notification_status, ip_address, user_agent, created_at)
    - Add foreign key constraints to stock_takes, users, and notifications tables
    - Create indexes on stock_take_id, created_at, and action columns
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 1.2 Add submission workflow columns to stock_takes table
    - Add submitted_at, submitted_by, verified_at, notification_sent, notification_sent_at columns
    - Create indexes on status, branch_id+status, and submitted_at columns
    - Ensure backward compatibility with existing stock-take records
    - _Requirements: 3.3, 4.1_
  
  - [ ]* 1.3 Write property test for database schema integrity
    - **Property 7: Verification Timestamp Recording**
    - **Validates: Requirements 3.3**

- [x] 2. Backend API endpoint for stock-take submission
  - [x] 2.1 Create PUT /api/stock-takes/:id/submit endpoint
    - Implement controller method in stock-take.controller.ts
    - Add route definition with authentication middleware
    - Implement request validation for stock-take ID
    - _Requirements: 1.1, 1.2, 5.1, 5.2_
  
  - [x] 2.2 Implement submission transaction logic with row locking
    - Use SELECT FOR UPDATE to lock stock-take row
    - Check current status and reject if already submitted/verified
    - Update status to 'submitted' with submitted_at and submitted_by
    - Ensure transaction rollback on any error
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 2.3 Write property test for duplicate submission prevention
    - **Property 11: Duplicate Submission Prevention**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 2.4 Implement audit log creation for status changes
    - Create audit log entry for draft → submitted transition
    - Include user_id, previous_status, new_status, event_type, event_data
    - Capture IP address and user agent from request
    - _Requirements: 4.1, 4.2_
  
  - [ ]* 2.5 Write property test for submission status change audit log
    - **Property 8: Submission Status Change Audit Log**
    - **Validates: Requirements 4.1**

- [x] 3. Checkpoint - Ensure submission endpoint works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Notification service integration
  - [x] 4.1 Implement notification payload builder
    - Create function to build StockTakeNotification payload
    - Include stock_take_id, branch_name, submission_date, variance_status, total_variance_value
    - Set notification type, category, priority, and action_url
    - _Requirements: 2.2_
  
  - [x] 4.2 Implement notification sending with retry logic
    - Call notificationService.notifyRole with 'auditor' role
    - Implement exponential backoff retry (1 retry with 1-2 second delay)
    - Log notification success/failure in audit log
    - Update notification_sent and notification_sent_at fields
    - _Requirements: 2.1, 2.3, 2.4_
  
  - [ ]* 4.3 Write property test for notification sent on submission
    - **Property 2: Notification Sent on Submission**
    - **Validates: Requirements 2.1**
  
  - [ ]* 4.4 Write property test for notification content completeness
    - **Property 3: Notification Content Completeness**
    - **Validates: Requirements 2.2**
  
  - [ ]* 4.5 Write property test for notification audit logging
    - **Property 4: Notification Audit Logging**
    - **Validates: Requirements 2.3**
  
  - [ ]* 4.6 Write property test for notification retry on failure
    - **Property 5: Notification Retry on Failure**
    - **Validates: Requirements 2.4**
  
  - [ ]* 4.7 Write property test for notification attempt audit logging
    - **Property 10: Notification Attempt Audit Logging**
    - **Validates: Requirements 4.4**

- [x] 5. Automatic status transition to verified
  - [x] 5.1 Implement automatic status transition logic
    - After successful notification, update status to 'verified'
    - Set verified_at timestamp
    - Create audit log entry for submitted → verified transition
    - Ensure transition happens within same transaction
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 5.2 Write property test for automatic status transition
    - **Property 6: Automatic Status Transition to Verified**
    - **Validates: Requirements 3.1**
  
  - [ ]* 5.3 Write property test for verification status change audit log
    - **Property 9: Verification Status Change Audit Log**
    - **Validates: Requirements 4.2**

- [x] 6. Error handling and validation
  - [x] 6.1 Implement validation error responses (400)
    - Check for incomplete stock-take items before submission
    - Return structured error response with field-level details
    - _Requirements: 5.1_
  
  - [x] 6.2 Implement conflict error responses (409)
    - Return conflict error when stock-take already submitted/verified
    - Include current status and submitted_at in response
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.3 Implement not found error responses (404)
    - Return 404 when stock-take ID does not exist
    - _Requirements: 5.1_
  
  - [x] 6.4 Implement partial success handling for notification failures
    - Return success response with warning when notification fails
    - Ensure status change completes even if notification fails
    - Log notification failure in audit log
    - _Requirements: 2.4_
  
  - [ ]* 6.5 Write unit tests for error handling scenarios
    - Test validation errors, conflict errors, not found errors
    - Test partial success with notification failure
    - Test transaction rollback on database errors

- [x] 7. Checkpoint - Ensure backend submission workflow is complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend UI - Stock-take detail view enhancements
  - [x] 8.1 Add status state management to StockTakeDetail component
    - Add status, isSubmitting state variables
    - Implement status refresh after submission
    - _Requirements: 1.1, 1.2_
  
  - [x] 8.2 Implement submit button visibility logic
    - Create shouldShowSubmitButton function
    - Hide button when status is 'submitted' or 'verified'
    - Show button for all other statuses
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 8.3 Write property test for submit button visibility
    - **Property 1: Submit Button Visibility Based on Status**
    - **Validates: Requirements 1.1, 1.2**
  
  - [x] 8.4 Implement submission handler with loading state
    - Call PUT /api/stock-takes/:id/submit endpoint
    - Show loading spinner during submission
    - Handle success response with status refresh
    - Handle error responses with user-friendly messages
    - _Requirements: 1.1, 5.2_
  
  - [ ]* 8.5 Write unit tests for StockTakeDetail component
    - Test button visibility for each status
    - Test loading state during submission
    - Test error message display
    - Test success message and navigation

- [x] 9. Frontend UI - Stock-take list view enhancements
  - [x] 9.1 Implement status badge rendering in BranchStockTakePage
    - Create getStatusBadge function with color, label, icon mapping
    - Render status badge for each stock-take in list
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 9.2 Write property test for status display in list view
    - **Property 12: Status Display in List View**
    - **Validates: Requirements 6.1**
  
  - [ ]* 9.3 Write property test for visual indicator differentiation
    - **Property 13: Visual Indicator Differentiation**
    - **Validates: Requirements 6.2**
  
  - [x] 9.4 Implement status refresh mechanism
    - Add polling or WebSocket for real-time status updates
    - Refresh list when status changes detected
    - _Requirements: 6.3_
  
  - [ ]* 9.5 Write unit tests for BranchStockTakePage component
    - Test status badge rendering for each status
    - Test badge colors and icons match specification
    - Test list refresh after status change

- [ ] 10. Integration and end-to-end testing
  - [ ]* 10.1 Write integration test for complete submission workflow
    - Test end-to-end flow from UI button click to database update
    - Verify notification sent to auditor
    - Verify audit trail completeness
    - Verify automatic status transition to verified
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 4.2_
  
  - [ ]* 10.2 Write integration test for concurrent submission attempts
    - Test race condition with multiple simultaneous submissions
    - Verify only one submission succeeds
    - Verify others receive 409 conflict error
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 10.3 Write integration test for notification delivery
    - Test notification appears in auditor's notification list
    - Verify notification payload contains all required fields
    - Test notification retry on failure
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 10.4 Write database transaction test for rollback scenarios
    - Test transaction rollback on notification failure (if configured)
    - Test row locking prevents concurrent modifications
    - Test audit log atomicity with status changes
    - _Requirements: 5.3, 3.4_

- [x] 11. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- Checkpoints ensure incremental validation and quality gates
- All property tests must run minimum 100 iterations
- All property tests must include comment tags referencing design document properties
