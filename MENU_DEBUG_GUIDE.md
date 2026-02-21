# Menu Items Loading Debug Guide

## Current Status
✅ Backend menu sync is working (34 categories, 292 items imported)
✅ Frontend code has been updated with enhanced logging
✅ Frontend rebuilt successfully

## Next Steps - Debug in Browser

### Step 1: Open the App and Check Console

1. **Start the app** (if not already running)
2. **Navigate to POS/Kitchen page** (`/dashboard/pos-kitchen`)
3. **Open DevTools Console** (F12 or Ctrl+Shift+I)

### Step 2: Look for Debug Messages

You should see messages like:
```
[Menu Debug] Total items in cache: 292
[Menu Debug] Filter params - branchId: X, categoryId: undefined, onlyAvailable: true
[Menu Debug] After filtering: X items
[Menu Debug] Sample item: {...}
Restaurant Menu Items: Loaded X items from local cache (branch: X)
```

### Step 3: Run Database Test

Copy and paste this into the browser console:

```javascript
(async () => {
    console.log('=== MENU CACHE TEST ===');
    
    if (!window.electronAPI) {
        console.error('❌ electronAPI not available');
        return;
    }
    
    console.log('✓ electronAPI is available');
    
    // Check categories
    const categories = await window.electronAPI.db.get('restaurant_menu_categories', {});
    console.log(`✓ Categories in cache: ${categories?.length || 0}`);
    if (categories && categories.length > 0) {
        console.log('Sample category:', categories[0]);
    }
    
    // Check menu items
    const items = await window.electronAPI.db.get('restaurant_menu_items', {});
    console.log(`✓ Menu items in cache: ${items?.length || 0}`);
    if (items && items.length > 0) {
        console.log('Sample item:', items[0]);
        console.log('Items with null branch_id:', items.filter(i => i.branch_id === null).length);
        console.log('Items with specific branch_id:', items.filter(i => i.branch_id !== null).length);
        console.log('Available items (is_available=1):', items.filter(i => i.is_available === 1).length);
        console.log('Unavailable items (is_available=0):', items.filter(i => i.is_available === 0).length);
    }
    
    console.log('=== TEST COMPLETE ===');
})();
```

## Common Issues and Solutions

### Issue 1: Items in cache but not showing
**Symptom**: Console shows "Total items in cache: 292" but "After filtering: 0 items"

**Possible Causes**:
1. **Branch filter too strict**: Items might have specific branch_id that doesn't match
2. **Availability filter**: Items might have `is_available = 0`
3. **Category filter**: Items might not match the selected category

**Solution**: Check the debug output for filter params and sample items

### Issue 2: electronAPI not available
**Symptom**: Console shows "electronAPI not available"

**Solution**: 
- Make sure you're running in Electron (not browser)
- Restart the app
- Check electron/preload.js is loaded correctly

### Issue 3: Database empty
**Symptom**: "Menu items in cache: 0"

**Solution**:
- Check electron console for "[Menu Auto-Sync]" messages
- Manually trigger sync: `window.electronAPI.cache.syncNow()`
- Check internet connection
- Verify Supabase credentials in .env

## Manual Sync Trigger

If items aren't syncing, trigger manually from browser console:

```javascript
// Trigger menu sync now
await window.electronAPI.cache.syncNow();
```

## What to Report Back

Please share:
1. All console messages starting with `[Menu Debug]`
2. Output from the database test script
3. Any error messages
4. Your current branch ID (shown in the UI)

## Files Modified
- `frontend/src/lib/api.ts` - Added debug logging to getMenuItems()
- Frontend rebuilt with new logging
