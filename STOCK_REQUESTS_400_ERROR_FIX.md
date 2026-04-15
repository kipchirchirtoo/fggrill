# Stock Requests 400 Error Fix

## Problem

The stock requests endpoint was returning a 400 Bad Request error:

```
GET https://api.hirall.com/api/store/stock-requests?status=PENDING_AUDIT 400 (Bad Request)
```

Error message: **"Branch ID required"**

## Root Causes

### Cause 1: Auditor Role Not Considered Global ❌

**File**: `backend/src/utils/branchIsolation.ts`

The `isGlobalRole()` function did NOT include `auditor` in the list of global roles:

```typescript
// WRONG ❌
const globalRoles = ['super_admin', 'general_manager', 'hr_manager', 'central_storekeeper'];
```

This meant that auditors were treated as branch-scoped users and required a `branch_id` in their profile to access stock requests.

### Cause 2: Poor Error Message

**File**: `backend/src/controllers/storekeeping/stock-requests.controller.ts`

The error message was too generic and didn't help diagnose the issue:

```typescript
// WRONG ❌
res.status(400).json({ success: false, message: 'Branch ID required' });
```

## Solution Applied

### Fix 1: Add Auditor to Global Roles ✅

**File**: `backend/src/utils/branchIsolation.ts`

```typescript
// CORRECT ✅
const globalRoles = ['super_admin', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor'];
```

**Rationale**:
- Auditors need to see stock requests across ALL branches for audit purposes
- The comment in the file even said "auditor" should be global, but the code didn't match
- `PENDING_AUDIT` status specifically indicates requests waiting for auditor review

### Fix 2: Improved Error Message ✅

**File**: `backend/src/controllers/storekeeping/stock-requests.controller.ts`

```typescript
// CORRECT ✅
res.status(400).json({ 
    success: false, 
    message: 'Branch ID required. Your user profile does not have a branch assigned. Please contact your administrator.',
    error: 'MISSING_BRANCH_ID',
    user_role: req.user?.role,
    user_id: req.user?.id
});
```

**Benefits**:
- Clear explanation of what's wrong
- Actionable guidance (contact administrator)
- Error code for programmatic handling
- Debug info (role, user_id) for troubleshooting

## Branch Isolation Logic

### Global Roles (Can Access All Branches)
- `super_admin` - Full system access
- `general_manager` - Cross-branch management
- `hr_manager` - HR operations across branches
- `central_storekeeper` - Central inventory management
- `auditor` - Audit operations across branches ✅ **ADDED**

### Branch-Scoped Roles (Restricted to Their Branch)
- `branch_manager` - Single branch management
- `branch_accountant` - Single branch accounting
- `branch_storekeeper` - Single branch inventory
- `cashier` - Single branch operations
- `waiter` - Single branch service
- All other roles

## How Branch Isolation Works

```typescript
// In getStockRequests controller:

const isCentralRole = isGlobalRole(req.user?.role);

if (!isCentralRole) {
    // Branch-scoped user: MUST use their assigned branch_id
    branchId = req.user?.branch_id || null;
    
    if (!branchId) {
        // ERROR: User has no branch assigned
        return 400 Bad Request
    }
} else {
    // Global role: Can optionally filter by branch_id from query params
    // If no branch_id provided, returns data from ALL branches
    branchId = req.query.branch_id || null;
}
```

## API Endpoint Details

### GET /api/store/stock-requests

**Query Parameters**:
- `status` (optional): Filter by status (e.g., `PENDING_AUDIT`, `APPROVED`, `REJECTED`)
- `branch_id` (optional): Filter by branch (only works for global roles)

**Valid Status Values**:
- `PENDING` - Initial state
- `PENDING_AUDIT` - Waiting for auditor review
- `UNDER_REVIEW` - Being reviewed
- `APPROVED` - Approved by auditor
- `PARTIALLY_APPROVED` - Some items approved
- `REJECTED` - Rejected by auditor
- `READY` - Ready for dispatch
- `DISPATCHED` - Dispatched to branch
- `VERIFIED` - Verified by recipient

**Response**:
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "uuid",
      "requesting_branch_id": 1,
      "status": "PENDING_AUDIT",
      "reason": "Low stock on beverages",
      "created_at": "2026-04-15T10:00:00Z",
      "items": [...]
    }
  ]
}
```

## Testing

### Before Fix
```bash
# Auditor user tries to fetch pending audit requests
GET /api/store/stock-requests?status=PENDING_AUDIT
Authorization: Bearer <auditor_token>

# Response: 400 Bad Request
{
  "success": false,
  "message": "Branch ID required"
}
```

### After Fix
```bash
# Auditor user can now fetch pending audit requests
GET /api/store/stock-requests?status=PENDING_AUDIT
Authorization: Bearer <auditor_token>

# Response: 200 OK
{
  "success": true,
  "count": 5,
  "data": [...]
}
```

## User Impact

**Before Fix**:
- ❌ Auditors could not view stock requests
- ❌ Auditor dashboard showed errors
- ❌ `PENDING_AUDIT` requests were inaccessible
- ❌ Audit workflow was blocked

**After Fix**:
- ✅ Auditors can view all stock requests across branches
- ✅ Auditor dashboard loads correctly
- ✅ `PENDING_AUDIT` requests are visible
- ✅ Audit workflow is functional

## Related Files

**Modified**:
- `backend/src/utils/branchIsolation.ts` - Added `auditor` to global roles
- `backend/src/controllers/storekeeping/stock-requests.controller.ts` - Improved error message

**Affected Endpoints**:
- `GET /api/store/stock-requests` - Now works for auditors
- All other endpoints using `isGlobalRole()` - Auditors now have global access

## Additional Notes

### Why Auditors Need Global Access

1. **Audit Scope**: Auditors must review transactions across ALL branches
2. **Compliance**: Regulatory requirements demand cross-branch oversight
3. **Fraud Detection**: Patterns may span multiple branches
4. **Reporting**: Audit reports aggregate data from all branches

### Branch Isolation Best Practices

1. **Default to Restricted**: Most roles should be branch-scoped
2. **Explicit Global Roles**: Only grant global access when necessary
3. **Document Decisions**: Comment why each role is global/scoped
4. **Audit Trail**: Log when global roles access other branches
5. **Error Messages**: Provide clear guidance when access is denied

## Status

✅ **COMPLETE** - Auditor role added to global roles, error message improved

---

**Fixed By**: Kiro AI Assistant  
**Date**: April 15, 2026  
**Issue**: Auditors couldn't access stock requests due to branch isolation  
**Solution**: Added `auditor` to global roles list  
**Rule Applied**: BUGFIX_RULES.md Rule #3 (Schema is the source of truth - role permissions must match business requirements)
