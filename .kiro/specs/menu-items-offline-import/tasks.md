# Implementation Plan: Menu Items Offline Import

## Overview

This implementation plan breaks down the menu items auto-import feature into discrete coding tasks. The approach follows the existing user auto-import pattern in `electron/main.js`, adding parallel logic for menu items. Each task builds incrementally, with testing integrated throughout to catch errors early.

## Tasks

- [x] 1. Implement core menu sync function
  - [x] 1.1 Create `performMenuSync()` function in electron/main.js
    - Write async function that accepts optional branchId parameter
    - Initialize Supabase client using hardcoded credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY with fallback to ANON_KEY)
    - Implement two-phase fetch: categories first, then menu items
    - Add error handling with try-catch and descriptive logging
    - Return result object with success, categoriesCount, itemsCount, and optional error
    - _Requirements: 1.2, 7.1, 7.2, 7.3, 5.1, 5.2_

  - [ ]* 1.2 Write property test for Supabase configuration
    - **Property 10: Supabase Configuration Consistency**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [x] 1.3 Implement category fetching logic
    - Query Supabase `restaurant_menu_categories` table
    - Select all fields: id, name, description, sort_order, is_active, is_bar
    - Handle query errors gracefully
    - Log number of categories fetched
    - _Requirements: 1.2, 4.3_

  - [ ]* 1.4 Write property test for category data preservation
    - **Property 1: Import Round-Trip Consistency (categories)**
    - **Validates: Requirements 4.3, 8.1**

  - [x] 1.5 Implement menu items fetching logic
    - Query Supabase `restaurant_menu_items` table
    - Apply branch_id filter if provided (include null branch_id items)
    - Select all fields: id, category_id, branch_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, preparation_time, created_at, updated_at
    - Handle query errors gracefully
    - Log number of items fetched
    - _Requirements: 1.2, 2.1, 2.2, 8.1, 8.2, 8.4_

  - [ ]* 1.6 Write property test for branch filtering
    - **Property 2: Branch Filtering Correctness**
    - **Validates: Requirements 2.1, 2.2**

- [x] 2. Implement database caching logic
  - [x] 2.1 Add category caching in `performMenuSync()`
    - Use database transaction for batch insert
    - Execute `INSERT OR REPLACE` for each category
    - Map all category fields to table columns
    - Log success/failure for each category
    - Continue processing on individual failures
    - _Requirements: 4.1, 4.3, 9.4_

  - [ ]* 2.2 Write property test for category-first ordering
    - **Property 3: Category-First Import Ordering**
    - **Validates: Requirements 4.1, 4.2**

  - [x] 2.3 Add menu items caching in `performMenuSync()`
    - Use database transaction for batch insert
    - Execute `INSERT OR REPLACE` for each menu item
    - Map all item fields to table columns
    - Verify category_id exists before inserting item
    - Log success/failure for each item
    - Continue processing on individual failures
    - _Requirements: 2.3, 8.1, 8.2, 8.3, 8.4, 9.4_

  - [ ]* 2.4 Write property test for round-trip consistency
    - **Property 1: Import Round-Trip Consistency**
    - **Validates: Requirements 1.3, 6.1, 8.1, 8.2, 8.4**

  - [ ]* 2.5 Write property test for referential integrity
    - **Property 15: Referential Integrity Preservation**
    - **Validates: Requirements 4.2**

- [ ] 3. Checkpoint - Verify core sync function
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement initial import on startup
  - [x] 4.1 Add initial import logic in app.on('ready') handler
    - Place after user auto-import (around line 1020 in main.js)
    - Use setTimeout with 2-second delay
    - Check if database is initialized
    - Query count of categories and items in Local_Cache
    - If both counts are zero, trigger performMenuSync()
    - Log whether import was triggered or skipped
    - Handle errors without blocking app startup
    - _Requirements: 1.1, 1.4, 1.5, 9.1, 9.2_

  - [ ]* 4.2 Write property test for empty cache trigger
    - **Property 4: Empty Cache Triggers Import**
    - **Validates: Requirements 1.1**

  - [ ]* 4.3 Write property test for non-empty cache skip
    - **Property 5: Non-Empty Cache Skips Import**
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Write property test for non-blocking import
    - **Property 12: Non-Blocking Import**
    - **Validates: Requirements 9.2**

- [x] 5. Implement background sync
  - [x] 5.1 Add background sync logic in app.on('ready') handler
    - Place after initial import setup (around line 1040 in main.js)
    - Use setTimeout with 5-second delay for initial sync
    - Call performMenuSync() immediately
    - Set up setInterval for 30-minute recurring sync
    - Store interval reference for cleanup
    - Handle errors without crashing app
    - _Requirements: 3.1, 3.5, 9.3_

  - [ ]* 5.2 Write property test for scheduled sync interval
    - **Property 11: Scheduled Sync Interval**
    - **Validates: Requirements 3.1, 3.5**

  - [ ]* 5.3 Write property test for incremental sync updates
    - **Property 6: Incremental Sync Updates**
    - **Validates: Requirements 3.3, 8.3**

  - [ ]* 5.4 Write property test for new item detection
    - **Property 7: New Item Detection**
    - **Validates: Requirements 3.2**

- [x] 6. Implement manual sync IPC handler
  - [x] 6.1 Add `autosync:syncMenuNow` IPC handler in setupIPC()
    - Accept optional branchId parameter
    - Call performMenuSync(branchId)
    - Return result object
    - Log manual sync trigger
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 6.2 Write property test for manual/automatic sync equivalence
    - **Property 13: Manual and Automatic Sync Equivalence**
    - **Validates: Requirements 10.1, 10.3**

  - [ ]* 6.3 Write unit tests for IPC handler
    - Test successful manual sync
    - Test manual sync with branch_id filter
    - Test manual sync error handling
    - _Requirements: 10.1, 10.2_

- [ ] 7. Checkpoint - Verify sync mechanisms
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement comprehensive error handling
  - [x] 8.1 Add authentication error handling
    - Check for missing credentials before Supabase client creation
    - Log descriptive error if credentials missing
    - Return failure result with error details
    - _Requirements: 5.1_

  - [x] 8.2 Add network error handling
    - Wrap Supabase queries in try-catch
    - Detect network-specific errors (timeout, connection refused)
    - Log error with context
    - Return failure result
    - _Requirements: 5.2_

  - [x] 8.3 Add database error handling
    - Wrap database operations in try-catch
    - Log specific item that failed
    - Continue processing remaining items
    - Track error count in result
    - _Requirements: 5.3_

  - [x] 8.4 Add comprehensive logging
    - Log start of sync operation
    - Log progress (categories fetched, items fetched)
    - Log completion with statistics
    - Log all errors with context
    - _Requirements: 3.4, 5.4_

  - [ ]* 8.5 Write property test for error resilience
    - **Property 8: Error Resilience**
    - **Validates: Requirements 1.5, 5.1, 5.2, 5.3, 5.5**

  - [ ]* 8.6 Write property test for sync result completeness
    - **Property 9: Sync Result Completeness**
    - **Validates: Requirements 5.4, 10.2**

  - [ ]* 8.7 Write unit tests for error scenarios
    - Test missing credentials error
    - Test network timeout error
    - Test database write error
    - Test partial failure (some items fail)
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 9. Verify IPC handler integration
  - [ ] 9.1 Test existing cache:getMenuItems handler
    - Verify it returns cached menu items
    - Verify branch_id filtering works
    - Verify data format matches expectations
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 9.2 Write property test for IPC retrieval
    - **Property 1: Import Round-Trip Consistency (via IPC)**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 9.3 Write unit tests for IPC integration
    - Test retrieving cached items after import
    - Test branch_id filtering in IPC handler
    - Test empty cache returns empty array
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 10. Implement batch operation optimization
  - [ ] 10.1 Optimize category insertion
    - Wrap all category inserts in single transaction
    - Use database.transaction() helper
    - Verify performance improvement
    - _Requirements: 9.4_

  - [ ] 10.2 Optimize menu items insertion
    - Wrap all item inserts in single transaction
    - Use database.transaction() helper
    - Verify performance improvement
    - _Requirements: 9.4_

  - [ ]* 10.3 Write property test for batch operations
    - **Property 14: Batch Operation Efficiency**
    - **Validates: Requirements 9.4**

- [ ] 11. Final integration and testing
  - [ ] 11.1 Integration test: Full startup flow
    - Test app startup with empty cache
    - Verify initial import triggers
    - Verify menu items accessible via IPC
    - _Requirements: 1.1, 1.3, 6.1_

  - [ ] 11.2 Integration test: Background sync flow
    - Test background sync after interval
    - Verify new items are detected
    - Verify updated items are refreshed
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 11.3 Integration test: Manual sync flow
    - Test manual sync via IPC
    - Verify immediate execution
    - Verify result format
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 11.4 Write end-to-end property tests
    - Test complete import-retrieve cycle
    - Test sync-retrieve cycle
    - Test error-recovery cycle
    - _Requirements: All_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- The implementation follows the existing user auto-import pattern for consistency
- All code should be added to `electron/main.js` following the existing structure
- Database tables already exist, no schema changes needed
