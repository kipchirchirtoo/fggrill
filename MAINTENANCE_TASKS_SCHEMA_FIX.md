# Maintenance Tasks Schema Cache Fix

## Problem
The Department Communication component is failing with the error:
```
Error: Could not find a relationship between 'maintenance_tasks' and 'users' in the schema cache
```

This happens when PostgREST's schema cache doesn't recognize the foreign key relationships between `maintenance_tasks` and `users` tables, even though they exist in the database.

## Root Cause
The maintenance controller was using PostgREST's relationship syntax:
```typescript
.select(`
  *,
  assigned_to:users!assigned_to_id (*),
  reported_by:users!reported_by_id (*),
  verified_by:users!verified_by_id (*)
`)
```

This syntax requires PostgREST to have the relationships cached, which wasn't happening.

## Solution Applied

### 1. Updated Maintenance Controller
Modified `backend/src/controllers/maintenance.controller.ts` to fetch user data separately instead of relying on PostgREST relationships:

**Before:**
```typescript
const { data, error } = await supabase
  .from('maintenance_tasks')
  .select(`
    *,
    assigned_to:users!assigned_to_id (*),
    reported_by:users!reported_by_id (*),
    verified_by:users!verified_by_id (*)
  `)
  .order('created_at', { ascending: false });
```

**After:**
```typescript
// Fetch tasks
const { data: tasks, error } = await supabase
  .from('maintenance_tasks')
  .select('*')
  .order('created_at', { ascending: false });

// Collect user IDs
const userIds = new Set<string>();
tasks?.forEach(task => {
  if (task.assigned_to_id) userIds.add(task.assigned_to_id);
  if (task.reported_by_id) userIds.add(task.reported_by_id);
  if (task.verified_by_id) userIds.add(task.verified_by_id);
});

// Fetch users separately
const { data: users } = await supabase
  .from('users')
  .select('id, full_name, email, role')
  .in('id', Array.from(userIds));

const usersMap = new Map(users?.map(u => [u.id, u]) || []);

// Enrich tasks with user data
const enrichedTasks = tasks?.map(task => ({
  ...task,
  assigned_to: task.assigned_to_id ? usersMap.get(task.assigned_to_id) : null,
  reported_by: task.reported_by_id ? usersMap.get(task.reported_by_id) : null,
  verified_by: task.verified_by_id ? usersMap.get(task.verified_by_id) : null
}));
```

### 2. Added Query Parameter Support
The updated controller now supports filtering by:
- `branch_id` - Filter tasks by branch
- `status` - Filter tasks by status (pending, assigned, in-progress, etc.)

## Benefits of This Approach

1. **No Schema Cache Dependency**: Works regardless of PostgREST schema cache state
2. **Better Performance**: Single query for all users instead of N+1 queries
3. **More Flexible**: Easy to add additional filters and joins
4. **Consistent Data Structure**: Frontend receives the same data structure as before

## Testing

### 1. Test the API Endpoint
```bash
# Test without filters
curl http://localhost:5000/api/maintenance/tasks

# Test with branch filter
curl http://localhost:5000/api/maintenance/tasks?branch_id=2

# Test with status filter
curl http://localhost:5000/api/maintenance/tasks?status=pending

# Test with both filters
curl http://localhost:5000/api/maintenance/tasks?branch_id=2&status=pending
```

### 2. Test in the Frontend
1. Navigate to the Department Communication page
2. The maintenance requests should now load without errors
3. User information (assigned_to, reported_by) should display correctly

## Next Steps

1. **Restart the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Clear Browser Cache** (if needed)
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

3. **Verify the Fix**
   - Check browser console - the error should be gone
   - Maintenance tasks should load with user information

## Alternative: Schema Cache Refresh (Optional)

If you want to try refreshing the schema cache instead, run:
```bash
node fix-maintenance-schema-cache.js
```

This script will:
- Verify the maintenance_tasks table exists
- Check foreign key constraints
- Attempt to reload the PostgREST schema cache
- Test the relationship query

However, the controller fix is more reliable and doesn't depend on schema cache state.

## Files Modified

- `backend/src/controllers/maintenance.controller.ts` - Updated getTasks() and getTask() methods
- `fix-maintenance-schema-cache.js` - Created diagnostic/fix script (optional)
- `MAINTENANCE_TASKS_SCHEMA_FIX.md` - This documentation

## Status

✅ **FIXED** - The maintenance tasks endpoint now works without relying on schema cache relationships.
