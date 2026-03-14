# Maintenance Tasks Quick Fix

## Problem
Department Communication page shows error:
```
Error: Could not find a relationship between 'maintenance_tasks' and 'users' in the schema cache
```

## Quick Fix (3 Steps)

### Step 1: Add Missing Columns to Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Add branch_id column
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_branch_id 
ON maintenance_tasks(branch_id);

-- Add room_number column  
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room_number 
ON maintenance_tasks(room_number);
```

**OR** run the migration script:
```bash
node add-branch-to-maintenance-tasks.js
```

### Step 2: Restart Backend Server

```bash
cd backend
# Kill the current process (Ctrl+C)
npm run dev
```

### Step 3: Test

1. Open the Department Communication page in your browser
2. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
3. The error should be gone and maintenance tasks should load

## What Was Fixed

1. **Controller Updated**: Changed from PostgREST relationship syntax to separate queries
   - No longer depends on schema cache
   - Fetches users separately and joins in application code
   
2. **Added Missing Columns**: 
   - `branch_id` - Filter tasks by branch
   - `room_number` - Associate tasks with specific rooms

3. **Added Query Filters**: Controller now supports:
   - `?branch_id=2` - Filter by branch
   - `?status=pending` - Filter by status

## Files Modified

- ✅ `backend/src/controllers/maintenance.controller.ts` - Fixed relationship queries
- ✅ `backend/migrations/versions/20251226_create_maintenance_schema.sql` - Added columns to schema
- ✅ `add-branch-to-maintenance-tasks.js` - Migration script
- ✅ `MAINTENANCE_TASKS_SCHEMA_FIX.md` - Detailed documentation

## Verification

Test the API endpoint:
```bash
# All tasks
curl http://localhost:5000/api/maintenance/tasks

# Filter by branch
curl http://localhost:5000/api/maintenance/tasks?branch_id=2

# Filter by status
curl http://localhost:5000/api/maintenance/tasks?status=pending
```

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "...",
      "status": "pending",
      "branch_id": 2,
      "assigned_to": {
        "id": "...",
        "full_name": "...",
        "email": "..."
      },
      "reported_by": {
        "id": "...",
        "full_name": "...",
        "email": "..."
      }
    }
  ]
}
```

## Status

✅ **READY TO TEST** - All fixes applied, just need to run the SQL and restart backend.
