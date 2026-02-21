# Implementation Plan: Offline Mode Auto-Detection Fix

## Overview

This implementation plan addresses the offline mode detection issue by removing the hardcoded testing override and verifying that the existing online/offline detection and sync queue processing mechanisms work correctly. The fix is minimal—primarily removing two lines of code—but includes comprehensive testing to ensure the system behaves correctly.

## Tasks

- [x] 1. Remove forced offline override
  - Remove lines 1325-1326 from electron/main.js that override the IPC handler
  - Verify the original `ipcMain.handle('net:isOnline', () => isOnline)` handler at line 1013 remains intact
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Verify online status detection logic
  - Review `checkOnlineStatus()` function (lines 154-185)
  - Confirm it checks multiple endpoints with proper timeouts
  - Confirm it returns true when any endpoint is reachable
  - Confirm it returns false when all endpoints fail
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. Verify status update and sync triggering
  - Review `updateOnlineStatus()` function (lines 187-201)
  - Confirm it updates global `isOnline` variable
  - Confirm it sends 'online-status' event to renderer
  - Confirm it triggers `processSyncQueue()` when transitioning from offline to online
  - _Requirements: 2.4, 2.5, 3.1_

- [x] 4. Verify sync queue processing logic
  - Review `processSyncQueue()` function (lines 203-240)
  - Confirm it returns early when offline or database unavailable
  - Confirm it only processes items with status='pending' and attempts < max_attempts
  - Confirm it marks items as 'synced' on success
  - Confirm it increments attempts and stores error on failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

- [x] 5. Verify periodic status check
  - Review the setInterval at lines 1474-1477
  - Confirm it runs every 30 seconds (30000ms)
  - Confirm it calls `updateOnlineStatus()` and `processSyncQueue()` when online
  - _Requirements: 2.4_

- [x] 6. Verify manual sync clear functionality
  - Review `sync:clear` IPC handler (lines 1003-1015)
  - Confirm it deletes pending, failed, and max-attempt items
  - Confirm it returns success status and remaining count
  - Confirm it logs the operation
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [-] 7. Test the fix manually
  - [ ] 7.1 Start the app with backend running
    - Verify app reports online status
    - Check developer console for online status logs
    - _Requirements: 2.1, 7.1, 7.2_
  
  - [ ] 7.2 Add test items to sync queue
    - Use developer console to queue test sync operations
    - Verify items appear in sync queue with pending status
    - _Requirements: 3.1, 4.2_
  
  - [ ] 7.3 Verify automatic sync when online
    - Wait for sync queue to process (should happen within 30 seconds)
    - Verify items are marked as synced
    - Verify status badge count decreases
    - _Requirements: 3.1, 3.4, 3.5, 7.1, 7.2_
  
  - [ ] 7.4 Test offline behavior
    - Stop the backend server
    - Wait for app to detect offline status (within 30 seconds)
    - Add new items to sync queue
    - Verify items remain pending and are not attempted
    - _Requirements: 2.3, 3.2, 4.1, 4.2, 4.3_
  
  - [ ] 7.5 Test online recovery
    - Restart the backend server
    - Wait for app to detect online status (within 30 seconds)
    - Verify pending items are processed automatically
    - Verify status badge shows accurate count
    - _Requirements: 2.1, 2.5, 3.1, 7.1, 7.2, 7.3_
  
  - [ ] 7.6 Test manual sync clear
    - Add items to sync queue
    - Open developer console
    - Run: `await window.electron.invoke('sync:clear')`
    - Verify queue is cleared
    - Verify status badge shows 0
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ]* 8. Write unit tests for online detection
  - Test backend reachable, internet unreachable → online
  - Test backend unreachable, internet reachable → online
  - Test both unreachable → offline
  - Test timeout on first endpoint, success on second → online
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 9. Write unit tests for sync queue processing
  - Test empty queue → no operations
  - Test queue with max attempts reached → skip those items
  - Test queue with mixed statuses → only process 'pending'
  - Test successful sync → item marked as 'synced'
  - Test failed sync → attempt counter incremented
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ]* 10. Write unit tests for IPC handlers
  - Test `net:isOnline` when online → returns true
  - Test `net:isOnline` when offline → returns false
  - Test `sync:clear` with pending items → items removed
  - Test `sync:clear` with empty queue → success response
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

- [ ]* 11. Write unit tests for state transitions
  - Test offline → online transition → sync queue triggered
  - Test online → offline transition → no sync triggered
  - Test online → online (no change) → no sync triggered
  - _Requirements: 2.5, 3.1_

- [ ]* 12. Write property test for online detection accuracy
  - **Property 1: Online Detection Accuracy**
  - **Validates: Requirements 2.1**
  - Generate random network states with backend reachable
  - Verify app reports online status as true
  - Run 100+ iterations

- [ ]* 13. Write property test for offline detection accuracy
  - **Property 2: Offline Detection Accuracy**
  - **Validates: Requirements 2.3**
  - Generate random network states with all endpoints unreachable
  - Verify app reports online status as false
  - Run 100+ iterations

- [ ]* 14. Write property test for sync queue processing guard
  - **Property 3: Sync Queue Processing Guard**
  - **Validates: Requirements 3.2**
  - Generate random sync queues
  - Set offline state
  - Verify no network calls are made
  - Run 100+ iterations

- [ ]* 15. Write property test for automatic sync processing
  - **Property 4: Sync Queue Automatic Processing**
  - **Validates: Requirements 3.1**
  - Generate random sync queues with pending items
  - Transition from offline to online
  - Verify sync queue is processed
  - Run 100+ iterations

- [ ]* 16. Write property test for sync item removal on success
  - **Property 5: Sync Item Removal on Success**
  - **Validates: Requirements 3.4**
  - Generate random sync items
  - Mock successful HTTP responses
  - Verify items marked as 'synced'
  - Run 100+ iterations

- [ ]* 17. Write property test for sync item retention on failure
  - **Property 6: Sync Item Retention on Failure**
  - **Validates: Requirements 3.3**
  - Generate random sync items
  - Mock failed HTTP responses
  - Verify attempt counter incremented and item remains in queue
  - Run 100+ iterations

- [ ]* 18. Write property test for IPC handler accuracy
  - **Property 7: IPC Handler Returns Actual Status**
  - **Validates: Requirements 1.2**
  - Generate random online/offline states
  - Call IPC handler
  - Verify returned value matches global state
  - Run 100+ iterations

- [ ]* 19. Write property test for manual clear operation
  - **Property 8: Manual Clear Removes All Pending**
  - **Validates: Requirements 5.2**
  - Generate random sync queues with various statuses
  - Call sync:clear
  - Verify all pending and failed items removed
  - Run 100+ iterations

- [ ]* 20. Write property test for status update notification
  - **Property 9: Status Update Notification**
  - **Validates: Requirements 2.5**
  - Generate random online/offline transitions
  - Verify renderer receives 'online-status' event
  - Run 100+ iterations

- [ ]* 21. Write property test for periodic check interval
  - **Property 10: Periodic Check Interval**
  - **Validates: Requirements 2.4**
  - Simulate time progression
  - Verify updateOnlineStatus called at 30-second intervals
  - Run 100+ iterations

- [x] 22. Checkpoint - Verify fix is working
  - Ensure all manual tests pass
  - Ensure app correctly detects online/offline status
  - Ensure sync queue processes automatically when online
  - Ensure sync queue doesn't process when offline
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster deployment
- The core fix is in task 1 (removing 2 lines of code)
- Tasks 2-6 are verification tasks to ensure existing code is correct
- Task 7 provides comprehensive manual testing steps
- Tasks 8-21 provide automated test coverage
- The fix is minimal and low-risk since it only removes test code
- All existing functionality remains intact
