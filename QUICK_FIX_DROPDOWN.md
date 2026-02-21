# Quick Fix: Kitchen Usage Dropdown Empty

## Problem
The dropdown shows "Select item" but no items appear when you click it.

## Root Cause
The frontend file keeps reverting to an old version that has a bug in the dropdown code.

## The Bug
**Line 97** in the old version uses:
```javascript
{items.map((item) => <option key={item.sku} value={item.sku}>{item.name}</option>)}
```

But the API returns:
```javascript
{
  item_sku: "FGH-KIT-SALT-0001",
  item_name: "Salt",
  quantity: 24,
  unit: "kg",
  category: "Kitchen"
}
```

So `item.sku` and `item.name` are `undefined`!

## Quick Fix (Manual Edit)

1. **Open the file**: `frontend/src/app/dashboard/branch-store/kitchen-usage/page.tsx`

2. **Find line 97** (inside the Dialog/modal):
```javascript
{items.map((item) => <option key={item.sku} value={item.sku}>{item.name}</option>)}
```

3. **Replace with**:
```javascript
{items.map((item) => <option key={item.item_sku} value={item.item_sku}>{item.item_name} ({item.quantity} available)</option>)}
```

4. **Save the file**

5. **The page should auto-reload** and dropdown will show items

## Alternative: Copy-Paste Fix

If the file keeps reverting, copy this entire select block and replace the existing one:

```jsx
<select 
  value={formData.item_sku} 
  onChange={(e) => setFormData({ ...formData, item_sku: e.target.value })} 
  className="w-full p-2 border rounded-ios-lg"
>
  <option value="">Select item</option>
  {items.map((item) => (
    <option key={item.item_sku} value={item.item_sku}>
      {item.item_name} - {item.quantity} {item.unit || 'units'} available
    </option>
  ))}
</select>
```

## Verify It Works

After the fix, open the modal and you should see items like:
- Salt - 24 kg available
- Alvaro Can - 52 units available
- etc.

## If Still Empty

1. **Check Network tab** in browser DevTools (F12)
2. **Look for request**: `/api/store/kitchen-usage/trackable-items`
3. **Check response**: Should have 18 items for branch 2
4. **If 401 error**: Token expired, logout and login again
5. **If 0 items**: Run `node check-kitchen-usage-data.js` to verify database

## Backend is Already Fixed

✅ Database error fixed
✅ API returns correct data structure
✅ 18 items available in branch 2

Only the frontend dropdown code needs the 3-character fix: `sku` → `item_sku`, `name` → `item_name`
