# Fix "20 PENDING SYNC" Issue

## Quick Fix (Do This Now)

1. **Open Developer Console in the Electron App**
   - Press `Ctrl+Shift+I` (or `F12`)
   - Click on the "Console" tab

2. **Paste this command and press Enter:**

```javascript
window.electronAPI.invoke('sync:clear').then(result => {
  console.log('Result:', result);
  window.location.reload();
});
```

3. **The app will refresh and the "20 PENDING SYNC" badge should be gone**

## What This Does

- Clears all pending and failed sync operations from the queue
- These operations were stuck because you're in offline mode
- They would never succeed anyway since there's no backend connection

## Why This Happened

You're running in **OFFLINE MODE** (no backend connection), but the app was still trying to queue operations to sync later. Since the backend is unreachable, these operations accumulated.

## Prevention

The sync queue is useful when you have intermittent connectivity, but in pure offline mode, it just accumulates failed operations. 

After clearing the queue, the app will work normally in offline mode without accumulating pending syncs.

## Alternative: Restart Fresh

If the above doesn't work, you can also:

1. Close the Electron app completely
2. Delete the sync queue data manually
3. Restart the app

But the console command above is the quickest solution.
