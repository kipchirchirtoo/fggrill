# Admin Users POS PIN Character Limit Fix

## Problem
In the `/dashboard/admin/users` page, the **Edit User Modal** had an incorrect character limit on the POS PIN input field. The `maxLength` was set to `4`, which only allowed 3 digits after the prefix (e.g., R123), when it should allow 4 digits (e.g., R1234).

## Root Cause
The Edit Modal's POS PIN input had `maxLength={4}` instead of `maxLength={5}`. This was inconsistent with:
1. The Create User Modal which correctly had `maxLength={5}`
2. The validation regex which expects format `[RBC]\d{4}` (1 letter + 4 digits = 5 characters total)
3. The placeholder text showing "R1234" (5 characters)

## Solution
Updated the Edit Modal's POS PIN input to match the Create Modal's implementation:

### Changes Made

**File**: `frontend/src/app/dashboard/admin/users/page.tsx`

**Before** (Line 1046):
```tsx
<Input
  value={formData.pos_pin}
  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
  className={`border-none p-0 h-auto focus-visible:ring-0 text-lg font-mono ${formErrors.pos_pin ? 'text-red-500' : ''}`}
  placeholder="e.g. R123"
  maxLength={4}  // ❌ WRONG - Only allows R123
/>
<p className="text-[10px] text-gray-400 mt-1">Waiters: RXXX | Bar: BXXX | Cashiers: CXXX</p>
```

**After**:
```tsx
<Input
  value={formData.pos_pin}
  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
  className={`border-none p-0 h-auto focus-visible:ring-0 text-lg font-mono ${formErrors.pos_pin ? 'text-red-500' : ''}`}
  placeholder="e.g. R1234"
  maxLength={5}  // ✅ CORRECT - Allows R1234
/>
<p className="text-[10px] text-gray-400 mt-1">Waiters: RXXXX | Bar: BXXXX | Cashiers: CXXXX</p>
```

### Additional Improvements
1. Updated placeholder from "R123" to "R1234" to show correct format
2. Updated helper text from "RXXX" to "RXXXX" to show 4 digits instead of 3

## POS PIN Format

### Valid Formats
- **Waiters**: R + 4 digits (e.g., R1234, R0001, R9999)
- **Bartenders**: B + 4 digits (e.g., B1234, B0001, B9999)
- **Cashiers**: C + 4 digits (e.g., C1234, C0001, C9999)

### Validation
The validation regex is: `/^[RBC]\d{4}$/`
- `[RBC]` - Must start with R, B, or C
- `\d{4}` - Followed by exactly 4 digits
- Total length: 5 characters

## Consistency Across Modals

### Create User Modal (Step 3)
```tsx
<Input
  value={formData.pos_pin}
  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
  className={`font-mono ${formErrors.pos_pin ? 'border-red-500' : ''}`}
  placeholder="e.g. R1234"
  maxLength={5}  // ✅ Correct
/>
<p className="text-xs text-gray-500 mt-1">Waiters: RXXXX, Bar: BXXXX, Cashiers: CXXXX</p>
```

### Edit User Modal (Step 3)
```tsx
<Input
  value={formData.pos_pin}
  onChange={(e) => setFormData({ ...formData, pos_pin: e.target.value.toUpperCase() })}
  className={`border-none p-0 h-auto focus-visible:ring-0 text-lg font-mono ${formErrors.pos_pin ? 'text-red-500' : ''}`}
  placeholder="e.g. R1234"
  maxLength={5}  // ✅ Now correct (was 4)
/>
<p className="text-[10px] text-gray-400 mt-1">Waiters: RXXXX | Bar: BXXXX | Cashiers: CXXXX</p>
```

## Testing Checklist

- [ ] Open Edit User Modal for any user
- [ ] Navigate to Step 3 (Contact Info)
- [ ] Try entering POS PIN "R1234"
- [ ] Verify all 5 characters are accepted
- [ ] Verify validation passes for valid formats (R1234, B5678, C9999)
- [ ] Verify validation fails for invalid formats (R123, RXXXX, 12345)
- [ ] Test with Create User Modal to ensure consistency
- [ ] Verify auto-uppercase works (typing "r1234" becomes "R1234")

## Related Files

- `frontend/src/app/dashboard/admin/users/page.tsx` - Main users page with modals
- `frontend/src/app/dashboard/hr/employees/page.tsx` - HR employees page (also has POS PIN with maxLength={6})

## Notes

- The HR employees page uses `maxLength={6}` which allows for longer PINs if needed
- The admin users page uses `maxLength={5}` which enforces the strict RXXXX format
- Both approaches are valid depending on requirements
- The validation regex `/^[RBC]\d{4}$/` enforces the 5-character format regardless of maxLength

## Impact

- ✅ Users can now enter full 4-digit POS PINs when editing users
- ✅ Consistent behavior between Create and Edit modals
- ✅ Matches validation rules and placeholder text
- ✅ No breaking changes - existing PINs remain valid

---

**Status**: ✅ Fixed
**Date**: April 15, 2026
**File Modified**: `frontend/src/app/dashboard/admin/users/page.tsx`
