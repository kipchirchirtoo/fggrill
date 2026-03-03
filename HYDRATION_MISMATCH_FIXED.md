# Hydration Mismatch Fixed - Image Alt Text

## ✅ FIXED

Fixed React hydration mismatch warnings caused by inconsistent image alt text between server and client rendering.

## Issue

Console warning:
```
Warning: Prop `alt` did not match. 
Server: "Kyogongs Background" 
Client: "Famous Gates Hotels Background"
```

This occurred because:
1. Server-side rendering used old cached HTML with "Kyogongs"
2. Client-side rendering used updated code with "Famous Gates Hotels"
3. React detected the mismatch and threw a warning

## Changes Made

Updated image alt text in the following files:

### 1. Login Page (`frontend/src/app/login/page.tsx`)
- Changed: `alt="Kyogongs Background"` → `alt="Famous Gates Hotels Background"`

### 2. Terminal Page (`frontend/src/app/terminal/page.tsx`)
- Changed: `alt="Kyogongs Background"` → `alt="Famous Gates Hotels Background"`

### 3. Public Homepage (`frontend/src/app/(public)/page.tsx`)
- Changed: `alt="Kyogongs"` → `alt="Famous Gates Hotels"`

### 4. Booking Page (`frontend/src/app/(public)/booking/page.tsx`)
- Changed: `alt="Kyogongs"` → `alt="Famous Gates Hotels"`

## Result

- No more hydration mismatch warnings
- Consistent branding across all pages
- Server and client rendering now match perfectly

## Note on Supplier Deletion Error

The console also shows a separate error:
```
Error: update or delete on table "store_suppliers" violates foreign key constraint 
"store_grni_control_account_supplier_id_fkey" on table "store_grni_control_account"
```

This is a database constraint issue unrelated to the hotel name changes. It means:
- A supplier cannot be deleted if it has related records in `store_grni_control_account`
- This is correct behavior to maintain data integrity
- To delete the supplier, first remove or reassign related GRNI records

## Files Modified

- `frontend/src/app/login/page.tsx`
- `frontend/src/app/terminal/page.tsx`
- `frontend/src/app/(public)/page.tsx`
- `frontend/src/app/(public)/booking/page.tsx`
