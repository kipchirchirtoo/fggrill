# Guest Registration Modal Scrollbar Fix

## Problem
The "New Guest Registration" modal didn't have a proper scrollbar, making it difficult to access all form fields on smaller screens.

## Solution Applied

Updated both modals in `frontend/src/app/dashboard/reception/guests/page.tsx`:

### 1. Guest Form Modal (New/Edit Guest)

**Changes:**
- Changed DialogContent from `overflow-y-auto` to `flex flex-col` layout
- Made DialogHeader `flex-shrink-0` (fixed at top)
- Made form content area `overflow-y-auto flex-1 pr-2` (scrollable middle section)
- Made button area `flex-shrink-0 pt-4 border-t` (fixed at bottom)

**Before:**
```tsx
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
  <DialogHeader>...</DialogHeader>
  <div className="grid grid-cols-2 gap-4 mt-4">
    {/* Form fields */}
  </div>
  <div className="flex gap-3 mt-6">
    {/* Buttons */}
  </div>
</DialogContent>
```

**After:**
```tsx
<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">...</DialogHeader>
  <div className="grid grid-cols-2 gap-4 mt-4 overflow-y-auto flex-1 pr-2">
    {/* Form fields - scrollable */}
  </div>
  <div className="flex gap-3 mt-6 flex-shrink-0 pt-4 border-t">
    {/* Buttons - always visible */}
  </div>
</DialogContent>
```

### 2. Guest Details Modal

Applied the same fix for consistency:
- Header stays at top
- Content scrolls in the middle
- Proper padding for scrollbar (`pr-2`)

## Benefits

✅ **Proper Scrolling**: Form content scrolls while header and buttons stay fixed
✅ **Better UX**: Buttons always visible and accessible
✅ **Responsive**: Works on all screen sizes
✅ **Visual Separation**: Border-top on button area for clear separation
✅ **Scrollbar Padding**: `pr-2` prevents content from being hidden under scrollbar

## Testing

1. Open Reception → Guests page
2. Click "New Guest" button
3. Modal should open with:
   - Fixed header at top
   - Scrollable form fields in middle
   - Fixed buttons at bottom
4. Try scrolling - only the form content should scroll
5. Buttons should always be visible

## Files Modified

- ✅ `frontend/src/app/dashboard/reception/guests/page.tsx`
  - Fixed GuestFormModal scrolling
  - Fixed GuestDetailsModal scrolling

## Status

✅ **FIXED** - Both modals now have proper scrollbars with fixed headers and footers.
