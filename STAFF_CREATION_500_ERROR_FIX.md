# Staff Creation 500 Error Fix

## Problem

Creating a new staff member via `POST /api/staff` was returning a 500 Internal Server Error:

```
POST https://api.hirall.com/api/staff 500 (Internal Server Error)
```

## Root Cause

**Database Schema Issue**: The `staff_profiles` table had a `NOT NULL` constraint on the `user_id` column, but the backend controller was not setting this field when creating staff members.

### Historical Context

1. **Original Schema** (`06_create_staff_tables.sql`):
   ```sql
   CREATE TABLE staff_profiles (
     id UUID PRIMARY KEY,
     user_id UUID REFERENCES users(id) NOT NULL,  -- ❌ Required
     ...
   );
   ```

2. **Decoupling Migration** (`20260210_staff_profiles_decouple.sql`):
   ```sql
   -- Staff can exist WITHOUT user accounts
   ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;
   ```

3. **Problem**: The migration may not have been applied to the production database, or was rolled back.

### Why user_id Should Be Nullable

**Design Decision**: Staff profiles are for **payroll, HR, and ID management** - NOT for system login accounts.

- **Housekeeping staff** - Don't need system access
- **Kitchen staff** - Don't need system access  
- **Security guards** - Don't need system access
- **Drivers** - Don't need system access

Only staff who need to use the system (managers, receptionists, waiters, etc.) should have user accounts.

## Solution Applied

### Fix 1: Migration to Ensure user_id is Nullable ✅

**File**: `backend/supabase/migrations/20260415_fix_staff_profiles_user_id_nullable.sql`

```sql
-- Make user_id nullable
ALTER TABLE staff_profiles ALTER COLUMN user_id DROP NOT NULL;

-- Add documentation
COMMENT ON COLUMN staff_profiles.user_id IS 'Optional link to users table. Staff can exist without system login accounts.';

-- Verify the change
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'staff_profiles' 
        AND column_name = 'user_id' 
        AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'Migration failed: user_id is still NOT NULL';
    ELSE
        RAISE NOTICE 'Migration successful: user_id is now nullable';
    END IF;
END $$;
```

### Fix 2: Improved Error Handling ✅

**File**: `backend/src/controllers/staff.controller.ts`

Added specific error messages for common database constraint violations:

```typescript
if (staffError) {
  logger.error('Error creating staff profile:', staffError);
  logger.error('Staff profile payload:', staffData);
  
  // NOT NULL constraint violation (23502)
  if (staffError.code === '23502') {
    const match = staffError.message.match(/column "(\w+)"/);
    const column = match ? match[1] : 'unknown';
    res.status(400).json({
      success: false,
      message: `Missing required field: ${column}`,
      error: 'MISSING_REQUIRED_FIELD',
      details: staffError.message
    });
    return;
  }
  
  // Unique constraint violation (23505)
  if (staffError.code === '23505') {
    res.status(400).json({
      success: false,
      message: 'A staff member with this information already exists',
      error: 'DUPLICATE_STAFF',
      details: staffError.message
    });
    return;
  }
  
  // Foreign key constraint violation (23503)
  if (staffError.code === '23503') {
    res.status(400).json({
      success: false,
      message: 'Invalid reference: branch_id or supervisor_id does not exist',
      error: 'INVALID_REFERENCE',
      details: staffError.message
    });
    return;
  }
  
  throw new Error(`Failed to create staff profile: ${staffError.message}`);
}
```

## PostgreSQL Error Codes

| Code | Name | Meaning | Fix |
|------|------|---------|-----|
| 23502 | not_null_violation | Required field is NULL | Provide the missing field or make column nullable |
| 23505 | unique_violation | Duplicate value in unique column | Use different value or remove unique constraint |
| 23503 | foreign_key_violation | Referenced record doesn't exist | Ensure foreign key references valid record |

## Database Schema After Fix

```sql
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),  -- ✅ NULLABLE (optional)
  
  -- Identity fields (required)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  national_id TEXT NOT NULL,
  
  -- Contact fields (optional)
  email TEXT,
  phone TEXT,
  
  -- Employment fields
  department TEXT NOT NULL,
  position TEXT,
  branch_id INTEGER REFERENCES branches(id),
  basic_salary DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoint Details

### POST /api/staff

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "national_id": "12345678",
  "department": "housekeeping",
  "position": "Room Attendant",
  "branch_id": 1,
  "phone": "+254712345678",
  "email": "john.doe@example.com",
  "basic_salary": 25000,
  "shift": "morning",
  "start_date": "2026-04-15"
}
```

**Required Fields**:
- `first_name` - Staff member's first name
- `last_name` - Staff member's last name
- `national_id` - National ID or passport number
- `department` - Department name

**Optional Fields**:
- `email` - Email address
- `phone` - Phone number
- `position` - Job title/position
- `branch_id` - Branch assignment
- `basic_salary` - Monthly salary
- `shift` - Work shift (morning/afternoon/night)
- `start_date` - Employment start date
- All other fields from the schema

**Success Response** (201):
```json
{
  "success": true,
  "data": {
    "staff": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "id_number": "FGH001",
      "department": "housekeeping",
      "status": "active",
      ...
    }
  },
  "message": "Staff member created successfully"
}
```

**Error Responses**:

**400 - Missing Required Field**:
```json
{
  "success": false,
  "message": "Missing required field: user_id",
  "error": "MISSING_REQUIRED_FIELD",
  "details": "null value in column \"user_id\" violates not-null constraint"
}
```

**400 - Duplicate Staff**:
```json
{
  "success": false,
  "message": "A staff member with this information already exists",
  "error": "DUPLICATE_STAFF",
  "details": "duplicate key value violates unique constraint"
}
```

**400 - Invalid Reference**:
```json
{
  "success": false,
  "message": "Invalid reference: branch_id or supervisor_id does not exist",
  "error": "INVALID_REFERENCE",
  "details": "insert or update on table \"staff_profiles\" violates foreign key constraint"
}
```

## Deployment Steps

### 1. Apply Migration

```bash
# Connect to Supabase
cd backend

# Apply the migration
npx supabase db push

# Or manually via SQL editor in Supabase Dashboard:
# Copy contents of 20260415_fix_staff_profiles_user_id_nullable.sql
# Paste into SQL Editor
# Run
```

### 2. Verify Migration

```sql
-- Check if user_id is nullable
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' 
AND column_name = 'user_id';

-- Expected result:
-- column_name | is_nullable | data_type
-- user_id     | YES         | uuid
```

### 3. Test Staff Creation

```bash
# Test creating staff without user account
curl -X POST https://api.hirall.com/api/staff \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Staff",
    "national_id": "99999999",
    "department": "housekeeping",
    "basic_salary": 20000
  }'

# Should return 201 Created
```

### 4. Restart Backend

```bash
# Restart the backend to load updated controller
pm2 restart backend
# or
npm run dev
```

## Testing Checklist

- [ ] Migration applied successfully
- [ ] user_id column is nullable
- [ ] Can create staff without user_id
- [ ] Can create staff with user_id
- [ ] Error messages are clear and specific
- [ ] Frontend shows proper error messages
- [ ] Staff ID is auto-generated correctly
- [ ] Branch assignment works
- [ ] Department validation works

## User Impact

**Before Fix**:
- ❌ Could not create any staff members
- ❌ 500 Internal Server Error
- ❌ No clear error message
- ❌ HR workflow blocked

**After Fix**:
- ✅ Can create staff members successfully
- ✅ Clear error messages for validation issues
- ✅ Staff can exist without user accounts
- ✅ HR workflow functional

## Related Files

**Modified**:
- `backend/supabase/migrations/20260415_fix_staff_profiles_user_id_nullable.sql` (NEW)
- `backend/src/controllers/staff.controller.ts` (MODIFIED)

**Related Migrations**:
- `backend/supabase/migrations/06_create_staff_tables.sql` - Original schema
- `backend/supabase/migrations/20260210_staff_profiles_decouple.sql` - First attempt to make user_id nullable

## Status

✅ **COMPLETE** - Migration created, error handling improved

⚠️ **ACTION REQUIRED**: Apply migration to production database

---

**Fixed By**: Kiro AI Assistant  
**Date**: April 15, 2026  
**Issue**: 500 error when creating staff due to NOT NULL constraint on user_id  
**Solution**: Migration to make user_id nullable + improved error handling  
**Rule Applied**: BUGFIX_RULES.md Rule #3 (Schema is the source of truth)
