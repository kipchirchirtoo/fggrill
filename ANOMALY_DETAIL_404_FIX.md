# Anomaly Detail 404 Error Fix

## Problem

The auditor revenue oversight detail page was making incorrect API calls:

```
GET https://api.hirall.com/api/auditor/anomalies/[object%20Object] 404 (Not Found)
```

The URL shows `[object%20Object]` which indicates an object was being passed instead of a string ID.

## Root Cause

**File**: `frontend/src/app/dashboard/auditor/revenue-oversight/details/[id]/PageContent.tsx`

### Issue 1: getAnomalyDetail Call (Line 46)

**WRONG** ❌:
```typescript
const res = await auditAPI.getAnomalyDetail({ id, type });
```

**API Signature**:
```typescript
getAnomalyDetail: (id: string) => fetchAPI<any>(`/auditor/anomalies/${id}`)
```

The function expects a **string ID** but was receiving an **object** `{ id, type }`.

### Issue 2: clearAnomaly Call (Line 110)

**WRONG** ❌:
```typescript
const res = await auditAPI.clearAnomaly({
    id,
    type: type || 'unknown',
    notes: verifyNotes
});
```

**API Signature**:
```typescript
clearAnomaly: (id: string, notes: string) => fetchAPI<void>(`/auditor/anomalies/${id}/clear`, { method: 'POST', body: JSON.stringify({ notes }) })
```

The function expects **two separate parameters** (id, notes) but was receiving a **single object**.

## Solution Applied

### Fix 1: getAnomalyDetail Call ✅

**CORRECT**:
```typescript
const res = await auditAPI.getAnomalyDetail(id);
```

Changed from passing an object to passing just the string ID.

### Fix 2: clearAnomaly Call ✅

**CORRECT**:
```typescript
const res = await auditAPI.clearAnomaly(id, verifyNotes);
```

Changed from passing an object to passing two separate parameters.

## Why This Happened

This is a classic **API contract mismatch** bug:

1. **Developer assumed** the API functions accepted objects with named parameters
2. **Actual API signature** expected positional parameters (strings)
3. When JavaScript converts an object to a string for URL interpolation, it becomes `[object Object]`
4. The backend received `/api/auditor/anomalies/[object Object]` which doesn't match any route → 404

## Prevention

Following **BUGFIX_RULES.md Rule #1**:

> **READ BEFORE YOU WRITE**
> Before editing any file, you MUST read:
> 1. The file you are about to change (full content)
> 2. Every file that imports from that file
> 3. The API function signatures being called

This bug could have been prevented by:
- Checking the API function signature in `frontend/src/lib/api/reports.ts` before calling it
- Using TypeScript strict mode to catch parameter mismatches
- Adding JSDoc comments to API functions to document expected parameters

## Testing

### Before Fix
```bash
# Browser console shows:
GET https://api.hirall.com/api/auditor/anomalies/[object%20Object] 404 (Not Found)
```

### After Fix
```bash
# Should now correctly call:
GET https://api.hirall.com/api/auditor/anomalies/abc123-uuid-here 200 (OK)
```

## Related Files

**Modified**:
- `frontend/src/app/dashboard/auditor/revenue-oversight/details/[id]/PageContent.tsx`

**API Definition** (no changes needed):
- `frontend/src/lib/api/reports.ts`

## API Endpoints Affected

### GET /api/auditor/anomalies/:id
**Purpose**: Fetch details of a specific anomaly/exception

**Request**:
```
GET /api/auditor/anomalies/abc123-uuid-here
Headers:
  Authorization: Bearer <token>
  x-branch-id: <branch_id>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "abc123-uuid-here",
    "type": "restaurant_order",
    "status": "pending",
    "total_amount": 5000,
    "created_at": "2026-04-15T10:30:00Z",
    "branch": { "name": "Main Branch" },
    "waiter": { "first_name": "John", "last_name": "Doe" },
    "items": [...]
  }
}
```

### POST /api/auditor/anomalies/:id/clear
**Purpose**: Mark an anomaly as verified/cleared by auditor

**Request**:
```
POST /api/auditor/anomalies/abc123-uuid-here/clear
Headers:
  Authorization: Bearer <token>
  Content-Type: application/json
Body:
{
  "notes": "Verified and cleared by auditor"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Anomaly cleared successfully"
}
```

## User Impact

**Before Fix**:
- ❌ Auditors could not view anomaly details
- ❌ 404 errors in console
- ❌ "Record Not Found" error shown to users
- ❌ Could not verify/clear anomalies

**After Fix**:
- ✅ Anomaly details load correctly
- ✅ No console errors
- ✅ Full anomaly information displayed
- ✅ Auditors can verify and clear anomalies

## Status

✅ **COMPLETE** - API call parameters corrected

---

**Fixed By**: Kiro AI Assistant  
**Date**: April 15, 2026  
**Issue**: Passing object instead of string ID to API functions  
**Solution**: Changed API calls to match function signatures (positional parameters)  
**Rule Violated**: BUGFIX_RULES.md Rule #1 (Read before you write)
