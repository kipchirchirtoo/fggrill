# Fix Offline Mode Detection

## Problem
The app is stuck in "OFFLINE MODE" even when the backend might be available. This causes:
- Sync queue to accumulate (20 pending syncs)
- Operations to fail unnecessarily
- Poor user experience

## Root Cause
The `checkOnlineStatus()` function tries to reach `http://127.0.0.1:5000/api/health` but:
1. Your backend server might not be running
2. The health endpoint might not exist
3. The endpoint URL might be wrong

## Solution Applied

### 1. Improved Health Check (electron/main.js)
Updated `checkOnlineStatus()` to try multiple endpoints:
- `http://127.0.0.1:5000/api/health`
- `http://127.0.0.1:5000/health`
- `http://127.0.0.1:5000/`
- `https://www.google.com` (fallback for internet connectivity)

This makes the detection more robust.

### 2. How It Works Now
- Checks online status every 30 seconds
- Tries multiple endpoints before declaring offline
- Automatically switches to online mode when backend is reachable
- Processes sync queue when coming back online

## To Test Online Mode

### Option 1: Start Your Backend Server
If you have a backend server, start it:
```bash
# In a separate terminal
cd backend
npm start
# or
node server.js
```

The app will automatically detect it within 30 seconds.

### Option 2: Check Current Status
Open Developer Console (`Ctrl+Shift+I`) and run:
```javascript
// Check current online status
console.log('Is Online:', window.navigator.onLine);

// Force a status check (if exposed)
window.electronAPI?.invoke('sync:status').then(status => {
  console.log('Sync Status:', status);
});
```

### Option 3: Work in Pure Offline Mode
If you don't need backend connectivity:
1. Clear the sync queue (see FIX_PENDING_SYNC.md)
2. Work normally in offline mode
3. All data is cached locally

## What Happens When Online

When the app detects the backend is online:
1. "OFFLINE MODE" badge disappears
2. Sync queue starts processing
3. Pending operations sync to backend
4. New operations go directly to backend
5. Data syncs bidirectionally

## What Happens When Offline

When the app can't reach the backend:
1. "OFFLINE MODE" badge appears
2. Operations queue for later sync
3. All reads come from local cache
4. App continues working normally

## Monitoring Online Status

Check the console logs:
```
[2026-02-17T...] [INFO] Backend is reachable at http://127.0.0.1:5000/, back ONLINE
```

Or:
```
[2026-02-17T...] [WARN] All health check endpoints failed, going OFFLINE
```

## Recommended Actions

### If You Have a Backend:
1. Start your backend server
2. Wait 30 seconds for auto-detection
3. Check console for "back ONLINE" message
4. Sync queue will process automatically

### If You Don't Have a Backend:
1. Clear the sync queue (see FIX_PENDING_SYNC.md)
2. Work in offline mode
3. All features work from local cache
4. No sync queue accumulation

## Files Modified
- `electron/main.js` - Improved `checkOnlineStatus()` function

## Next Steps
1. Decide if you need backend connectivity
2. If yes: Start backend server
3. If no: Clear sync queue and work offline
4. App will auto-detect and adapt
