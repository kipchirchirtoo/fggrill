# Quick Start - Restart and Test

## 1. Restart the Electron App

Close the current app completely, then restart:
```bash
npm run electron:dev
```

## 2. What to Check in Console Logs

After startup, you should see:
```
[Cache] Normalized user: KIPTOO DON
[Orders Auto-Sync] Starting orders sync...
[Orders Auto-Sync] Found X orders
[Orders Auto-Sync] ✓ Cached X orders and Y items
```

## 3. Test Orders Display

1. Login with PIN: R0234
2. Click the clock icon (History) or user menu
3. Click "Order History" or "My Orders"
4. You should see today's orders

**Console logs to look for:**
```
[Cache] Getting orders for user adfcf845-1b7a-4a27-ba7c-4c5a127c8b0b, branch 1, from 2026-02-17, to 2026-02-17
[Cache] Found 1 orders
[Restaurant Orders] Loaded 1 orders from cache
```

## 4. Test Bill Generation

1. Create a new order or select an existing one
2. Click "Print" or generate a bill
3. Check the "Served by" field

**Console logs to look for:**
```
[Bill] User object: {id: '...', firstName: 'KIPTOO', ...}
[Bill] firstName: KIPTOO first_name: KIPTOO
[Bill] lastName: DON last_name: DON
```

## Expected Results

✓ Orders appear in "My Orders" modal
✓ Bill shows "Served by: KIPTOO DON" (not "undefined undefined")
✓ Auto-sync runs in background every 5 minutes
✓ Manual sync triggers when opening history

## If Something's Wrong

Check the console logs and look for:
- Any error messages
- Missing logs (e.g., no "[Cache] Getting orders" log)
- User object structure in "[Bill] User object:" log

Then report the specific error or missing log.
