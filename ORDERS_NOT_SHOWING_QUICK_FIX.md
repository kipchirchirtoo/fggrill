# 🚨 QUICK FIX: Orders Not Showing

## The Issue

You're seeing "All (0)" in the My Orders modal because orders aren't being fetched properly.

## ⚠️ IMPORTANT: Are You in the Electron App?

The error `window.electronAPI.invoke is not a function` means you're in the **WEB BROWSER**, not the **ELECTRON APP**.

The diagnostic scripts ONLY work in the Electron desktop app!

---

## 🎯 Quick Fix Steps

### STEP 1: Rebuild the Frontend

I've already fixed the code. Now rebuild:

```bash
cd frontend
npm run build
```

Wait for it to complete (should take 1-2 minutes).

### STEP 2: Restart the Electron App

Close and restart the Electron desktop application.

### STEP 3: Check Console Logs in Electron App

1. **In the Electron app** (not browser), press `Ctrl+Shift+I`
2. Go to the Console tab
3. Look for these logs when you open "My Orders":
   ```
   [UnifiedPOS] Fetching orders for user: <user_id> branch: <branch_id> date: 2024-02-17
   [UnifiedPOS] Orders fetch result: true count: X
   ```

### STEP 4: If No Orders Appear

The issue might be:

**A) No orders in Supabase for today**
- Check your Supabase database
- Look in the `restaurant_orders` table
- Filter by today's date
- Make sure there are orders created by your user

**B) Orders not synced to cache**
- The auto-sync runs every 5 minutes
- It syncs orders from the last 1 day
- Wait 5 minutes or restart the app to trigger sync

**C) Wrong date selected**
- The date picker defaults to TODAY
- If your orders are from yesterday, change the date
- Click the date picker and select the correct date

---

## 🔍 Manual Check (In Electron App Only)

If you want to manually check, **in the Electron app Developer Console**:

### Check if orders are in cache:
```javascript
window.electronAPI.invoke('db:get', 'restaurant_orders', {}).then(orders => {
    console.log('Total orders in cache:', orders?.length || 0);
    if (orders && orders.length > 0) {
        console.log('Sample order:', orders[0]);
        console.log('Dates:', orders.map(o => o.created_at?.split('T')[0]));
    }
});
```

### Trigger manual sync:
```javascript
window.electronAPI.invoke('autosync:syncOrdersNow').then(result => {
    console.log('Sync result:', result);
    setTimeout(() => window.location.reload(), 2000);
});
```

---

## 📊 Understanding the Date Filter

The "My Orders" modal filters by:

1. **Date**: Shows orders from the selected date (default: today)
2. **User**: Shows orders created by you or assigned to you as waiter
3. **Branch**: Shows orders from your active branch
4. **Status**: Can filter by All/Pending/Verified/Void

If you created orders yesterday, you need to:
1. Click the date picker (shows today's date)
2. Select yesterday's date
3. Orders from yesterday will appear

---

## 🎯 Most Common Issues

### Issue 1: "All (0)" - No orders showing

**Cause**: No orders in cache for today

**Solution**:
1. Check if orders exist in Supabase for today
2. Wait for auto-sync (runs every 5 minutes)
3. Or manually trigger sync (see commands above)
4. Or change the date to when you created orders

### Issue 2: "window.electronAPI.invoke is not a function"

**Cause**: You're in the web browser, not Electron app

**Solution**:
1. Close the web browser
2. Open the Electron desktop app
3. Run commands there

### Issue 3: Orders exist but not showing

**Cause**: Date filter or user filter excluding them

**Solution**:
1. Change date picker to the date when orders were created
2. Switch from "My Orders" to "All Orders" to see all branch orders
3. Check the status filter (All/Pending/Verified/Void)

---

## ✅ Verification Steps

After rebuilding and restarting:

1. [ ] Frontend rebuilt (`npm run build` completed)
2. [ ] Electron app restarted
3. [ ] Opened "My Orders" modal (clock icon)
4. [ ] Checked Developer Console for logs
5. [ ] Tried changing the date picker
6. [ ] Tried "All Orders" filter
7. [ ] Checked Supabase for orders

---

## 🆘 Still Not Working?

If orders still don't show after:
- Rebuilding frontend
- Restarting Electron app
- Waiting 5 minutes for auto-sync
- Checking different dates

Then the issue is likely:
1. **No orders in Supabase** - Create a test order first
2. **Orders in different branch** - Check branch filter
3. **Orders created by different user** - Use "All Orders" filter

---

## 📝 Summary

1. ✅ Code is fixed (date filters added)
2. 🔨 Rebuild frontend: `cd frontend && npm run build`
3. 🔄 Restart Electron app
4. 📅 Check date picker - make sure it's the right date
5. 👥 Try "All Orders" to see all branch orders
6. ⏰ Wait for auto-sync or trigger manually

The fix is ready - just rebuild and restart! 🚀
