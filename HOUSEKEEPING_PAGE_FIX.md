# Housekeeping Page Data Fix

## Problem
The Reception Housekeeping page shows:
- "No room status data available"
- "No active housekeeping requests"

## Root Causes

### 1. Room Grid Data Structure Mismatch
The backend returns:
```json
{
  "success": true,
  "data": {
    "floors": [1, 2, 3],
    "rooms": [...],
    "roomsByFloor": {...}
  }
}
```

But the frontend expects:
```json
{
  "data": [...rooms...],
  "rooms": [...rooms...]
}
```

### 2. Tasks Data Structure
Similar issue with tasks endpoint - needs proper data extraction.

## Quick Fix

Update the data extraction in `frontend/src/app/dashboard/reception/housekeeping/page.tsx`:

### Fix Room Grid Data Extraction (Line ~60)
```typescript
// OLD:
const roomsData = roomsRes.data || roomsRes.rooms || roomsRes || [];
setRoomStatuses(Array.isArray(roomsData) ? roomsData.map((r: any) => ({
  room_number: r.room_number,
  status: r.cleaning_status || r.status || 'clean',
  last_cleaned: r.last_cleaned
})) : []);

// NEW:
const roomsData = roomsRes.data?.rooms || roomsRes.rooms || roomsRes.data || roomsRes || [];
setRoomStatuses(Array.isArray(roomsData) ? roomsData.map((r: any) => ({
  room_number: r.roomNumber || r.room_number,
  status: r.status || r.hk_status || r.cleaning_status || 'clean',
  last_cleaned: r.lastCleaned || r.last_cleaned_at || r.last_cleaned
})) : []);
```

### Fix Tasks Data Extraction (Line ~55)
```typescript
// OLD:
const tasksData = tasksRes.data || tasksRes.tasks || tasksRes || [];
setTasks(Array.isArray(tasksData) ? tasksData : []);

// NEW:
const tasksData = tasksRes.data?.tasks || tasksRes.tasks || tasksRes.data || tasksRes || [];
setTasks(Array.isArray(tasksData) ? tasksData : []);
```

## Alternative: Check Backend Response

Test the endpoints to see what they actually return:

```bash
# Test room grid endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/housekeeping/dashboard/room-grid?branchId=YOUR_BRANCH_ID"

# Test tasks endpoint  
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/housekeeping/tasks?status=pending&branch_id=YOUR_BRANCH_ID"
```

## Files to Update
- `frontend/src/app/dashboard/reception/housekeeping/page.tsx` - Fix data extraction logic
