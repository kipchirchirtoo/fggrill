# Quick Start: Menu Items Auto-Import

## 🚀 Start the App

```bash
npm run electron:dev
```

## ✅ Verify It's Working

### Check Console Logs

Look for these messages in the terminal:

```
[Menu Auto-Import] Cache empty, importing from Supabase...
[Menu Auto-Import] Fetching categories...
[Menu Auto-Import] Found X categories
[Menu Auto-Import] ✓ Cached X categories
[Menu Auto-Import] Fetching menu items...
[Menu Auto-Import] Found Y menu items
[Menu Auto-Import] ✓ Cached Y menu items
[Menu Auto-Import] ✓ Sync complete - X categories, Y items
[Menu Auto-Import] ✓ Imported X categories and Y items
```

### Run Test Script

```bash
node test-menu-import.js
```

Expected output:
```
=== Menu Items Import Test ===
✓ Menu Categories: 15
✓ Menu Items: 120

Sample Categories:
  - Appetizers (Restaurant) [Active]
  - Main Course (Restaurant) [Active]
  - Desserts (Restaurant) [Active]
  ...

Sample Menu Items:
  - Grilled Chicken - $15.99 (Main Course) [All Branches]
  - Caesar Salad - $8.99 (Appetizers) [Branch 1]
  ...

✓ SUCCESS: Menu items are cached and ready for offline use!
```

## 🔄 Background Sync

The app automatically syncs menu items every 30 minutes. You'll see:

```
[Menu Background Sync] Running scheduled sync...
[Menu Auto-Sync] Starting menu sync...
```

## 🎯 Manual Sync (Optional)

From the frontend, you can trigger manual sync:

```javascript
const result = await window.electronAPI.invoke('autosync:syncMenuNow');
console.log(`Synced ${result.categoriesCount} categories and ${result.itemsCount} items`);
```

## 📊 Access Menu Items

From the frontend:

```javascript
// Get all menu items for current branch
const branchId = localStorage.getItem('activeBranchId');
const menuItems = await window.electronAPI.invoke('cache:getMenuItems', branchId);

console.log(`Loaded ${menuItems.length} menu items`);
```

## 🐛 Troubleshooting

### No items imported?

1. Check Supabase credentials in `electron/main.js` (lines 8-11)
2. Verify Supabase tables exist: `restaurant_menu_categories`, `restaurant_menu_items`
3. Check internet connection (for initial import)
4. Look for error messages in console with `[Menu Auto-Sync]` prefix

### Items not showing in POS?

1. Verify offline mode is active (token = 'offline-bridge-token')
2. Check branch ID is correct
3. Run test script to verify items are in database
4. Check frontend is using correct IPC handler

## 📁 Database Location

Windows: `%APPDATA%/fg-pos-terminal/pos-offline.db`

You can inspect it with any SQLite browser.

## 🎉 That's It!

Your POS terminal now has full offline menu access. Menu items are automatically cached and kept up-to-date!
