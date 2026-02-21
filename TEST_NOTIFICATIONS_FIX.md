# Test Guide: Notification 404 Fix

## Quick Test Steps

### Test 1: Branch Store Request Notification
1. **Login as Branch Storekeeper**
   - Navigate to: Stock Requests
   - Create a new stock request with 2-3 items
   - Note the request number

2. **Login as Central Storekeeper**
   - Check notifications (bell icon)
   - You should see: "New Stock Request from [Branch]"
   - **Click the notification**
   - ✅ Should open: `/dashboard/central-store/requests/[id]`
   - ✅ Should show: Request details with approve/reject buttons

3. **Approve the Request**
   - Click "Approve" button
   - Adjust quantities if needed
   - Click "Approve Request"
   - ✅ Should show success message

4. **Login back as Branch Storekeeper**
   - Check notifications
   - You should see: "Stock Request Approved"
   - **Click the notification**
   - ✅ Should open: `/dashboard/branch-store/requests/[id]`
   - ✅ Should show: Request details with approved quantities

### Test 2: Request Rejection Notification
1. **Login as Branch Storekeeper**
   - Create another stock request

2. **Login as Central Storekeeper**
   - Click the notification
   - ✅ Should open detail page (no 404)
   - Click "Reject" button
   - Enter rejection reason
   - Click "Reject Request"

3. **Login back as Branch Storekeeper**
   - Check notifications
   - You should see: "Stock Request Rejected"
   - **Click the notification**
   - ✅ Should open detail page (no 404)
   - ✅ Should show rejection reason

### Test 3: Direct URL Access
1. **Get a request ID** from any existing request
2. **Test Branch Store URL:**
   ```
   http://localhost:3001/dashboard/branch-store/requests/[paste-id-here]
   ```
   - ✅ Should load detail page

3. **Test Central Store URL:**
   ```
   http://localhost:3001/dashboard/central-store/requests/[paste-id-here]
   ```
   - ✅ Should load detail page with approve/reject buttons

## Expected Results

### Before Fix:
- ❌ Clicking notification → 404 error
- ❌ URL: `/dashboard/store/requests/[id]` → Not Found

### After Fix:
- ✅ Clicking notification → Opens detail page
- ✅ Branch URL: `/dashboard/branch-store/requests/[id]` → Works
- ✅ Central URL: `/dashboard/central-store/requests/[id]` → Works
- ✅ Can approve/reject from detail page
- ✅ All data displays correctly

## What to Check

### Branch Store Detail Page:
- [ ] Request number displays
- [ ] Status badge shows correct color
- [ ] Date created shows
- [ ] Priority and type display
- [ ] All items listed with quantities
- [ ] Approved quantities show (if approved)
- [ ] Rejection reasons show (if rejected)
- [ ] Review notes display (if any)
- [ ] Back button works
- [ ] Refresh button works

### Central Store Detail Page:
- [ ] All branch store features PLUS:
- [ ] Requesting branch name shows
- [ ] Approve button visible (if pending)
- [ ] Reject button visible (if pending)
- [ ] Approve modal opens with quantity inputs
- [ ] Can adjust quantities per item
- [ ] Reject modal opens with reason input
- [ ] Approval works correctly
- [ ] Rejection works correctly
- [ ] Notifications sent after approval/rejection

## Troubleshooting

### If notification still shows 404:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check if backend restarted (should auto-reload)
4. Check browser console for errors

### If detail page doesn't load:
1. Check if request ID exists in database
2. Verify user has correct role permissions
3. Check network tab for API errors
4. Verify backend is running on port 5000

### If approve/reject doesn't work:
1. Check user role (must be central storekeeper, super admin, or GM)
2. Check request status (must be PENDING)
3. Check browser console for errors
4. Verify API endpoint is responding

## Success Criteria

✅ All tests pass without 404 errors  
✅ Notifications are clickable and open correct pages  
✅ Detail pages show all information  
✅ Approve/reject functionality works  
✅ Users receive notifications after actions  
✅ No console errors  

---

**Test Date:** February 19, 2026  
**Status:** Ready for Testing  
**Estimated Test Time:** 10 minutes
