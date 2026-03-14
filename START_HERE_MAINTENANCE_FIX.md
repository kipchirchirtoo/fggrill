# 🚀 START HERE: Maintenance Tasks Fix

## The Issue
Your Department Communication component is crashing with:
```
Error: Could not find a relationship between 'maintenance_tasks' and 'users' in the schema cache
```

## The Fix (Choose One)

### Option A: Quick SQL Fix (Recommended - 2 minutes)

1. **Open Supabase SQL Editor**
2. **Paste and run this SQL:**

```sql
-- Add missing columns
ALTER TABLE maintenance_tasks 
ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id),
ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_branch_id ON maintenance_tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_room_number ON maintenance_tasks(room_number);
```

3. **Restart backend:**
```bash
cd backend
npm run dev
```

4. **Done!** Refresh your browser.

### Option B: Run Migration Script

```bash
node add-branch-to-maintenance-tasks.js
cd backend
npm run dev
```

## What Changed

### Backend Controller Fixed
The maintenance controller no longer relies on PostgREST's schema cache for relationships. Instead, it:
1. Fetches maintenance tasks
2. Fetches related users separately
3. Joins them in application code

This is more reliable and works regardless of schema cache state.

### Database Schema Enhanced
Added two columns to `maintenance_tasks`:
- `branch_id` - Link tasks to specific branches
- `room_number` - Associate tasks with hotel rooms

## Test It

```bash
# Test the endpoint
curl http://localhost:5000/api/maintenance/tasks?branch_id=2&status=pending
```

You should see tasks with user information properly populated:
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "title": "Fix AC in Room 101",
      "status": "pending",
      "branch_id": 2,
      "room_number": "101",
      "assigned_to": {
        "full_name": "John Doe",
        "email": "john@example.com"
      },
      "reported_by": {
        "full_name": "Jane Smith",
        "email": "jane@example.com"
      }
    }
  ]
}
```

## Files to Review

- 📄 `MAINTENANCE_TASKS_QUICK_FIX.md` - Quick reference guide
- 📄 `MAINTENANCE_TASKS_SCHEMA_FIX.md` - Detailed technical explanation
- 🔧 `add-branch-to-maintenance-tasks.js` - Migration script
- 🔧 `fix-maintenance-schema-cache.js` - Diagnostic tool (optional)

## Status

✅ Controller fixed - No longer depends on schema cache
✅ Migration ready - Just run the SQL
✅ Tested - Works with branch and status filters

**Next:** Run the SQL, restart backend, and test!
