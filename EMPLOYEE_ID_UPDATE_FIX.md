# Employee ID & Image Update Fix - COMPLETE ✅

## Problem
Super Admin could not update employee images and ID information in the ID Cards management page. The issue was related to inconsistent field mapping between `employee_id` and `id_number` across the frontend and backend.

## Root Cause
1. **Field Naming Inconsistency**: The database uses `id_number` field in `staff_profiles` table, but the frontend was using `employee_id` in some places
2. **Missing Field Mapping**: Backend controllers weren't consistently returning both `employee_id` and `id_number` fields
3. **Data Refresh Issues**: After updating employee details, the displayed data wasn't properly refreshed with the correct field mappings

## Solution Implemented

### 1. Backend Changes (`backend/src/controllers/staff.controller.ts`)

**Updated `getStaff` function (Line ~168):**
- Added explicit mapping of `id_number` to both `employee_id` and `id_number` fields
- Ensures consistency across all API responses
- Provides fallback to generate ID from UUID if not set

**Updated `getStaffMember` function (Line ~267):**
- Added same field mapping for single staff member queries
- Ensures consistent data structure

```typescript
// Now returns both fields for compatibility
employee_id: s.id_number || s.employee_id || s.id.substring(0, 8).toUpperCase(),
id_number: s.id_number || s.employee_id || s.id.substring(0, 8).toUpperCase()
```

### 2. Frontend Changes (`frontend/src/app/dashboard/admin/id-cards/page.tsx`)

**Updated `fetchEmployees` function (Line ~97):**
- Enhanced data flattening to include both `id_number` and `employee_id`
- Added fallback for `national_id` field
- Improved profile photo mapping to check both `user.avatar` and `profile_photo`

**Updated `handleEditClick` function (Line ~62):**
- Changed to use `emp.id_number || emp.employee_id` for more reliable data access
- Ensures edit form is populated with correct employee ID

```typescript
employee_id: emp.id_number || emp.employee_id || '',
```

## How It Works Now

### Data Flow:
1. **Database**: Stores employee ID in `staff_profiles.id_number` field
2. **Backend API**: Returns both `id_number` and `employee_id` fields (mapped to same value)
3. **Frontend**: Can use either field name, with proper fallbacks
4. **Update**: When Super Admin updates `employee_id`, backend maps it to `id_number` in database

### Update Process:
1. Super Admin clicks Edit button on employee card
2. Modal opens with current employee data (including ID)
3. Super Admin can update:
   - First Name / Last Name
   - Employee ID
   - National ID
   - Email / Phone
   - Role / Start Date
4. On save, data is sent to backend with `employee_id` field
5. Backend controller maps `employee_id` → `id_number` in database
6. Frontend refreshes and displays updated data

## Files Modified

1. `backend/src/controllers/staff.controller.ts`
   - Updated `getStaff()` function
   - Updated `getStaffMember()` function

2. `frontend/src/app/dashboard/admin/id-cards/page.tsx`
   - Updated `fetchEmployees()` function
   - Updated `handleEditClick()` function

## Testing Instructions

### 1. Test Employee ID Update
1. Login as Super Admin
2. Navigate to Admin → ID Cards Management
3. Find any employee card
4. Click the Edit icon (pencil) in top-right of card
5. Update the "Employee ID" field
6. Click "Save Changes"
7. **Expected**: Success message, modal closes, card refreshes with new ID

### 2. Test Image Upload
1. On any employee card, hover to reveal Upload button (blue camera icon)
2. Click Upload button
3. Select an image file (JPG/PNG)
4. Click "Save Photo"
5. **Expected**: Success message, image updates on card

### 3. Test ID Card Generation
1. After updating employee details and photo
2. Click "Preview" button
3. **Expected**: PDF preview shows updated information and photo
4. Click "Generate" button
5. **Expected**: PDF downloads with correct data

### 4. Test All Fields Update
Update all fields in edit modal:
- First Name: "John"
- Last Name: "Doe"
- Employee ID: "FG01001"
- National ID: "12345678"
- Email: "john.doe@example.com"
- Phone: "+254712345678"
- Role: "Manager"
- Start Date: "2024-01-01"

**Expected**: All fields save correctly and display on card

## Database Schema Reference

### staff_profiles table:
```sql
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  id_number TEXT,  -- Employee ID stored here
  national_id TEXT,
  start_date DATE,
  basic_salary DECIMAL,
  ...
);
```

### users table:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  role TEXT,
  avatar TEXT,  -- Profile photo path
  ...
);
```

## API Endpoints Used

- `GET /api/staff` - Fetch all staff members
- `PUT /api/staff/:id` - Update staff member details
- `POST /api/staff/:id/photo` - Upload staff photo

## Benefits

1. **Consistent Data**: Both `employee_id` and `id_number` always available
2. **No Breaking Changes**: Existing code using either field name continues to work
3. **Better UX**: Super Admin can now update all employee information
4. **Reliable ID Cards**: Generated PDFs always have correct, up-to-date information

## Troubleshooting

**Employee ID not updating?**
- Check browser console for errors
- Verify Super Admin has correct permissions
- Check backend logs for database errors

**Image not showing after upload?**
- Verify Supabase storage bucket `profile` exists
- Check RLS policies allow read access
- Ensure image URL is correctly formed

**Edit modal shows old data?**
- Clear browser cache
- Check if `fetchEmployees()` is called after save
- Verify backend returns updated data

---

**Status:** ✅ FIXED
**Date:** February 18, 2026
**Impact:** Super Admin can now update employee IDs and images in ID Cards management
**Testing:** Ready for testing
