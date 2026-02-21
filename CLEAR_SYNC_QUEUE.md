# Clear Sync Queue - Fix "20 PENDING SYNC"

## Problem
You have 20 pending sync operations that are stuck because:
1. The app is in OFFLINE MODE
2. These operations were queued but can't reach the backend
3. They keep retrying and failing

## Solution: Clear the Sync Queue

### Option 1: Use the App's Developer Console

1. In the Electron app, press `Ctrl+Shift+I` to open Developer Tools
2. Go to the Console tab
3. Run this command:

```javascript
// Clear all pending syncs
window.electronAPI.invoke('db:delete', 'sync_queue', { status: 'pending' })
  .then(() => console.log('✓ Cleared pending syncs'))
  .catch(err => console.error('Error:', err));
```

4. Refresh the page or restart the app
5. The "20 PENDING SYNC" badge should be gone

### Option 2: Clear All Sync Queue Data

If you want to clear ALL sync queue data (pending, failed, synced):

```javascript
// WARNING: This clears ALL sync history
window.electronAPI.db.get('sync_queue', {})
  .then(items => {
    console.log('Found', items.length, 'sync queue items');
    return Promise.all(items.map(item => 
      window.electronAPI.invoke('db:delete', 'sync_queue', { id: item.id })
    ));
  })
  .then(() => console.log('✓ Cleared all sync queue'))
  .catch(err => console.error('Error:', err));
```

### Option 3: Add a Clear Button (Recommended)

I can add a button in the UI to clear the sync queue. This would be the cleanest solution.

## Why This Happens

The sync queue is designed to store operations when offline and sync them when back online. However, in your case:

1. You're running in pure offline mode (no backend connection)
2. Operations get queued but never succeed
3. They accumulate over time

## Prevention

For offline-only mode, we should:
1. Disable the sync queue entirely
2. Or add a "Clear Sync Queue" button in the UI
3. Or automatically clear failed syncs after X attempts

## Quick Fix Now

**Press `Ctrl+Shift+I` in the app, then paste this in the console:**

```javascript
window.electronAPI.invoke('db:delete', 'sync_queue', { status: 'pending' })
  .then(() => {
    console.log('✓ Cleared pending syncs');
    window.location.reload();
  });
```

This will clear the pending syncs and refresh the page.
