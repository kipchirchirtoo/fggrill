# Staff Dropdown Empty in Credit Bills Modal - Fix

## Problem

Staff members are not loading in the cashier "Add Credit Bill" modal dropdown. The dropdown shows "No staff found" even though staff exist in the database.

## Root Cause

**Branch Filtering Conflict**: The backend `getStaff` controller applies branch filtering in two places:

1. **Line 153**: `applyBranchFilter(query, req)` - Filters by user's branch from JWT token
2. **Line 159-161**: `if (req.query.branch_id) query = query.eq('branch_id', req.query.branch_id)` - Filters by query parameter

For branch-scoped users (cashiers, branch managers), the `applyBranchFilter` restricts results to their assigned branch. However, if the frontend passes a different `branch_id` in the query, it creates a conflict where NO staff match both conditions.

### Example Scenario

```typescript
// User's JWT token says: branch_id = 1
// Frontend passes: ?branch_id=2

// Backend query becomes:
SELECT * FROM staff_profiles 
WHERE branch_id = 1  -- from applyBranchFilter
AND branch_id = 2    -- from query parameter
// Result: NO ROWS (impossible condition)
```

## Solution

### Option 1: Remove Duplicate branch_id Filter (RECOMMENDED) ✅

**File**: `backend/src/controllers/staff.controller.ts`

```typescript
// Apply generic branch isolation
query = applyBranchFilter(query, req);

// REMOVE THIS - it conflicts with applyBranchFilter
// if (req.query.branch_id) {
//   query = query.eq('branch_id', req.query.branch_id);
// }

// Keep other filters
if (req.query.department) {
  query = query.eq('department', req.query.department);
}
if (req.query.status) {
  query = query.eq('status', req.query.status);
}
```

**Rationale**: `applyBranchFilter` already handles branch filtering correctly based on user role. The duplicate filter causes conflicts.

### Option 2: Make Frontend Not Pass branch_id

**File**: `frontend/src/components/common/StaffDropdownModal.tsx`

```typescript
const fetchStaff = async () => {
  setIsLoading(true);
  try {
    const params: any = { status: 'active' };
    // REMOVE THIS LINE - let backend handle branch filtering
    // if (activeBranchId) params.branch_id = activeBranchId;
    if (roleFilter) params.role = roleFilter;

    const response = await staffAPI.getStaff(params);
    // ...
  }
};
```

**Rationale**: Let the backend's `applyBranchFilter` handle branch isolation automatically based on the user's role and token.

### Option 3: Fix applyBranchFilter Logic

**File**: `backend/src/utils/branchIsolation.ts`

```typescript
export const applyBranchFilter = (query: any, req: Request, tableAlias: string = '') => {
    const userRole = (req as any).user?.role;
    const userBranchId = (req as any).user?.branch_id;
    const queryBranchId = (req as any).query?.branch_id;

    // If query explicitly specifies branch_id, use that (for global roles)
    if (isGlobalRole(userRole) && queryBranchId) {
        const column = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
        return query.eq(column, queryBranchId);
    }

    // Otherwise, apply user's branch restriction
    if (!isGlobalRole(userRole) && userBranchId) {
        const column = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
        return query.eq(column, userBranchId);
    }
    
    return query;
};
```

## Recommended Fix (Quick)

Remove the duplicate `branch_id` filter from the `getStaff` controller:

```typescript
// backend/src/controllers/staff.controller.ts
// Line 159-161 - COMMENT OUT OR REMOVE

// Apply generic branch isolation
query = applyBranchFilter(query, req);

// ❌ REMOVE THIS - causes conflict
// if (req.query.branch_id) {
//   query = query.eq('branch_id', req.query.branch_id);
// }

// ✅ KEEP other filters
if (req.query.department) {
  query = query.eq('department', req.query.department);
}
```

## Testing

### Test 1: Branch-Scoped User (Cashier)
```bash
# Login as cashier (branch_id = 1)
# Open credit bills modal
# Click "Select staff member"
# Expected: Shows staff from branch 1
```

### Test 2: Global User (Super Admin)
```bash
# Login as super admin
# Open credit bills modal
# Click "Select staff member"
# Expected: Shows staff from all branches
```

### Test 3: API Direct Test
```bash
# Test as branch-scoped user
curl -H "Authorization: Bearer CASHIER_TOKEN" \
  "https://api.hirall.com/api/staff?status=active"

# Should return staff from cashier's branch only
```

## User Impact

**Before Fix**:
- ❌ Staff dropdown shows "No staff found"
- ❌ Cannot create credit bills
- ❌ Workflow blocked

**After Fix**:
- ✅ Staff dropdown loads correctly
- ✅ Can select staff members
- ✅ Can create credit bills
- ✅ Workflow functional

## Related Files

**Backend**:
- `backend/src/controllers/staff.controller.ts` - Remove duplicate branch_id filter
- `backend/src/utils/branchIsolation.ts` - Branch filtering logic

**Frontend**:
- `frontend/src/components/common/StaffDropdownModal.tsx` - Staff selection modal
- `frontend/src/components/dashboard/branch/CreditBillsContent.tsx` - Credit bills page

## Status

⚠️ **ACTION REQUIRED** - Apply fix to backend controller

---

**Identified By**: Kiro AI Assistant  
**Date**: April 15, 2026  
**Issue**: Staff dropdown empty due to conflicting branch filters  
**Solution**: Remove duplicate branch_id filter from getStaff controller  
**Rule Applied**: BUGFIX_RULES.md Rule #1 (Read before you write - understand all filters)
