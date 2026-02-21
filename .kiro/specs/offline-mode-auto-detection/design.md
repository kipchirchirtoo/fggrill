# Design Document: Offline Mode Auto-Detection Fix

## Overview

This design addresses the offline mode detection issue in the Electron POS application caused by hardcoded testing overrides. The fix involves removing the forced offline code and ensuring the existing online detection and sync queue processing mechanisms work correctly.

The current implementation has all the necessary infrastructure for online/offline detection (`checkOnlineStatus()`, `updateOnlineStatus()`, `processSyncQueue()`), but it's being overridden by test code at lines 1325-1326 in `electron/main.js`.

## Architecture

The POS app uses a three-layer architecture for offline/online management:

1. **Detection Layer**: `checkOnlineStatus()` - Tests multiple endpoints to determine connectivity
2. **State Management Layer**: `updateOnlineStatus()` - Updates the global `isOnline` state and notifies renderer
3. **Sync Layer**: `processSyncQueue()` - Processes pending sync operations when online

### Current Flow

```
Periodic Check (30s) → updateOnlineStatus() → checkOnlineStatus() → Update isOnline
                                            ↓
                                    Notify Renderer
                                            ↓
                                    If back online → processSyncQueue()
```

### Problem

```javascript
// Line 1325-1326 in electron/main.js
ipcMain.removeHandler('net:isOnline');
ipcMain.handle('net:isOnline', () => false);  // ALWAYS returns false
```

This override prevents the renderer from getting the actual online status, causing the app to behave as if it's always offline.

## Components and Interfaces

### 1. Online Status Detection

**Function**: `checkOnlineStatus()`
- **Location**: electron/main.js (lines 154-185)
- **Purpose**: Determines if backend API or internet is reachable
- **Returns**: `Promise<boolean>`

**Algorithm**:
1. Try multiple endpoints in sequence:
   - `${API_BASE_URL}/api/health`
   - `${API_BASE_URL}/health`
   - `${API_BASE_URL}/`
   - `https://www.google.com` (fallback)
2. For each endpoint:
   - Set 5-second timeout
   - Attempt fetch with no-cache headers
   - If response.ok, return true
3. If all fail, return false

**Current Implementation**: ✅ Correct (no changes needed)

### 2. Status Update Manager

**Function**: `updateOnlineStatus()`
- **Location**: electron/main.js (lines 187-201)
- **Purpose**: Updates global state and triggers sync when coming back online
- **Returns**: `Promise<boolean>`

**Algorithm**:
1. Store previous online state
2. Call `checkOnlineStatus()` to get current state
3. Update global `isOnline` variable
4. Send 'online-status' event to renderer
5. If transitioned from offline to online, call `processSyncQueue()`
6. Return current online status

**Current Implementation**: ✅ Correct (no changes needed)

### 3. Sync Queue Processor

**Function**: `processSyncQueue()`
- **Location**: electron/main.js (lines 203-240)
- **Purpose**: Processes pending sync operations when online
- **Returns**: `void`

**Algorithm**:
1. Early return if database not initialized or offline
2. Query pending items (status='pending', attempts < max_attempts, limit 20)
3. For each item:
   - Prepare headers (Content-Type, Authorization if token exists)
   - Attempt fetch to backend
   - If successful: Mark as 'synced', log success
   - If failed: Increment attempts, calculate exponential backoff, log error
4. Update sync queue status in database

**Current Implementation**: ✅ Correct (no changes needed)

### 4. IPC Handler for Online Status

**Handler**: `net:isOnline`
- **Location**: electron/main.js (line 1326 - OVERRIDE, line 1013 - ORIGINAL)
- **Purpose**: Provides online status to renderer process
- **Returns**: `boolean`

**Current Implementation**: ❌ Overridden to always return false

**Required Fix**:
```javascript
// REMOVE lines 1325-1326:
// ipcMain.removeHandler('net:isOnline');
// ipcMain.handle('net:isOnline', () => false);

// KEEP line 1013 (original handler):
ipcMain.handle('net:isOnline', () => isOnline);
```

### 5. Periodic Status Check

**Location**: electron/main.js (lines 1474-1477)
- **Purpose**: Runs status check and sync every 30 seconds
- **Implementation**:
```javascript
setInterval(async () => {
    await updateOnlineStatus();
    if (isOnline) processSyncQueue();
}, 30000);
```

**Current Implementation**: ✅ Correct (no changes needed)

### 6. Manual Sync Queue Clear

**Handler**: `sync:clear`
- **Location**: electron/main.js (lines 1003-1015)
- **Purpose**: Allows manual clearing of stuck sync queue items
- **Returns**: `{ success: boolean, cleared?: boolean, remaining?: number, error?: string }`

**Current Implementation**: ✅ Correct (no changes needed)

## Data Models

### Sync Queue Item

**Table**: `sync_queue`
**Schema**:
```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    body TEXT,
    branch_id INTEGER,
    token TEXT,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 10,
    error TEXT,
    created_at TEXT NOT NULL,
    last_attempt TEXT
)
```

**Status Values**:
- `pending`: Waiting to be synced
- `synced`: Successfully synced
- `failed`: Exceeded max attempts

### Online Status State

**Type**: Global variable
**Location**: `electron/main.js` (line 107)
```javascript
let isOnline = true;
```

**Lifecycle**:
- Initialized to `true` on app start
- Updated every 30 seconds by `updateOnlineStatus()`
- Updated when transitioning between online/offline states
- Queried by renderer via `net:isOnline` IPC handler

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Online Detection Accuracy

*For any* network state, when the backend API is reachable, the app should report online status as true.

**Validates: Requirements 2.1**

### Property 2: Offline Detection Accuracy

*For any* network state, when both the backend API and internet are unreachable, the app should report online status as false.

**Validates: Requirements 2.3**

### Property 3: Sync Queue Processing Guard

*For any* sync queue state, when online status is false, the `processSyncQueue()` function should return early without attempting any network operations.

**Validates: Requirements 3.2**

### Property 4: Sync Queue Automatic Processing

*For any* sync queue containing pending items, when online status transitions from false to true, the sync queue should be processed automatically.

**Validates: Requirements 3.1**

### Property 5: Sync Item Removal on Success

*For any* sync queue item, when a sync operation completes successfully (HTTP 200-299), the item should be marked as 'synced' in the database.

**Validates: Requirements 3.4**

### Property 6: Sync Item Retention on Failure

*For any* sync queue item, when a sync operation fails due to network error, the item should remain in the queue with incremented attempt count.

**Validates: Requirements 3.3**

### Property 7: IPC Handler Returns Actual Status

*For any* call to the `net:isOnline` IPC handler, the returned value should equal the current value of the global `isOnline` variable.

**Validates: Requirements 1.2**

### Property 8: Manual Clear Removes All Pending

*For any* sync queue state, when `sync:clear` is invoked, all items with status 'pending' or 'failed' should be removed from the database.

**Validates: Requirements 5.2**

### Property 9: Status Update Notification

*For any* online status change, the renderer process should receive an 'online-status' event with the new status within the same event loop tick.

**Validates: Requirements 2.5**

### Property 10: Periodic Check Interval

*For any* 30-second interval after app startup, the `updateOnlineStatus()` function should be called exactly once.

**Validates: Requirements 2.4**

## Error Handling

### Network Timeout Handling

**Scenario**: Endpoint check takes too long
**Handling**: 
- Each endpoint check has a 5-second timeout via `AbortController`
- If timeout occurs, catch the error and try next endpoint
- Log warning if all endpoints fail

**Code Location**: `checkOnlineStatus()` lines 164-172

### Database Unavailable

**Scenario**: Database not initialized when sync queue is accessed
**Handling**:
- `processSyncQueue()` returns early if `!db`
- All IPC handlers check `if (!db)` and return appropriate error responses
- Log error messages for debugging

**Code Locations**: 
- Line 203 in `processSyncQueue()`
- Lines 942, 951, 961, 972, 1003 in IPC handlers

### Sync Operation Failures

**Scenario**: Individual sync item fails to send
**Handling**:
- Catch error and increment attempt counter
- Calculate exponential backoff: `Math.min(60000, 1000 * Math.pow(2, attempts))`
- Store error message in database
- Log failure with retry timing
- Item remains in queue for next sync cycle

**Code Location**: Lines 226-232 in `processSyncQueue()`

### Renderer Communication Failure

**Scenario**: Main window destroyed when trying to send status update
**Handling**:
- Check `if (mainWindow)` before sending events
- Gracefully skip notification if window unavailable
- Status will be queried via IPC when renderer is ready

**Code Location**: Lines 193-195 in `updateOnlineStatus()`

## Testing Strategy

### Unit Tests

Unit tests should focus on specific examples and edge cases:

1. **Online Detection Edge Cases**:
   - Backend reachable, internet unreachable → online
   - Backend unreachable, internet reachable → online
   - Both unreachable → offline
   - Timeout on first endpoint, success on second → online

2. **Sync Queue Edge Cases**:
   - Empty queue → no operations
   - Queue with max attempts reached → skip those items
   - Queue with mixed statuses → only process 'pending'
   - Successful sync → item marked as 'synced'
   - Failed sync → attempt counter incremented

3. **IPC Handler Examples**:
   - Call `net:isOnline` when online → returns true
   - Call `net:isOnline` when offline → returns false
   - Call `sync:clear` with pending items → items removed
   - Call `sync:clear` with empty queue → success response

4. **State Transition Examples**:
   - Offline → Online transition → sync queue triggered
   - Online → Offline transition → no sync triggered
   - Online → Online (no change) → no sync triggered

### Property-Based Tests

Property tests should verify universal properties across all inputs. Each test should run a minimum of 100 iterations.

1. **Property 1: Online Detection Accuracy**
   - **Tag**: Feature: offline-mode-auto-detection, Property 1: Online detection accuracy
   - **Test**: Generate random network states, verify backend reachable → online
   - **Generators**: Mock fetch responses (success/failure)

2. **Property 2: Offline Detection Accuracy**
   - **Tag**: Feature: offline-mode-auto-detection, Property 2: Offline detection accuracy
   - **Test**: Generate random network states, verify all unreachable → offline
   - **Generators**: Mock fetch failures for all endpoints

3. **Property 3: Sync Queue Processing Guard**
   - **Tag**: Feature: offline-mode-auto-detection, Property 3: Sync queue processing guard
   - **Test**: Generate random sync queues, set offline, verify no network calls
   - **Generators**: Random sync queue items, offline state

4. **Property 4: Sync Queue Automatic Processing**
   - **Tag**: Feature: offline-mode-auto-detection, Property 4: Sync queue automatic processing
   - **Test**: Generate random queues, transition offline→online, verify processing
   - **Generators**: Random sync queue items, state transitions

5. **Property 5: Sync Item Removal on Success**
   - **Tag**: Feature: offline-mode-auto-detection, Property 5: Sync item removal on success
   - **Test**: Generate random sync items, mock success, verify marked as synced
   - **Generators**: Random sync queue items, successful HTTP responses

6. **Property 6: Sync Item Retention on Failure**
   - **Tag**: Feature: offline-mode-auto-detection, Property 6: Sync item retention on failure
   - **Test**: Generate random sync items, mock failure, verify attempt incremented
   - **Generators**: Random sync queue items, failed HTTP responses

7. **Property 7: IPC Handler Returns Actual Status**
   - **Tag**: Feature: offline-mode-auto-detection, Property 7: IPC handler returns actual status
   - **Test**: Generate random online states, verify IPC returns same value
   - **Generators**: Random boolean states

8. **Property 8: Manual Clear Removes All Pending**
   - **Tag**: Feature: offline-mode-auto-detection, Property 8: Manual clear removes all pending
   - **Test**: Generate random queues, call clear, verify pending/failed removed
   - **Generators**: Random sync queue items with various statuses

9. **Property 9: Status Update Notification**
   - **Tag**: Feature: offline-mode-auto-detection, Property 9: Status update notification
   - **Test**: Generate random status changes, verify renderer notified
   - **Generators**: Random online/offline transitions

10. **Property 10: Periodic Check Interval**
    - **Tag**: Feature: offline-mode-auto-detection, Property 10: Periodic check interval
    - **Test**: Run timer, verify updateOnlineStatus called at 30s intervals
    - **Generators**: Time-based simulation

### Integration Tests

Integration tests should verify the complete flow:

1. **End-to-End Online Detection**:
   - Start app with backend running
   - Verify online status reported correctly
   - Stop backend
   - Verify offline status reported correctly
   - Restart backend
   - Verify online status restored

2. **End-to-End Sync Queue Processing**:
   - Add items to sync queue while offline
   - Verify items remain pending
   - Go online
   - Verify items processed automatically
   - Check backend received the synced data

3. **Manual Sync Clear**:
   - Add items to sync queue
   - Call sync:clear via IPC
   - Verify queue emptied
   - Verify status badge shows 0

### Testing Tools

- **Unit Testing**: Jest or Mocha for Node.js
- **Property Testing**: fast-check (JavaScript property-based testing library)
- **Mocking**: Sinon.js for mocking fetch, timers, and IPC
- **Integration**: Spectron or Playwright for Electron app testing

### Test Configuration

All property-based tests must be configured with:
- Minimum 100 iterations per test
- Seed logging for reproducibility
- Shrinking enabled for minimal failing examples
- Timeout of 30 seconds per test
