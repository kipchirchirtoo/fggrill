# Global Search 404 Error Fix

## Problem

The frontend was making calls to `GET /api/search?q=QUERY` but this endpoint didn't exist in the backend, resulting in 404 errors:

```
GET https://api.hirall.com/api/search?q=KIPCHIRCHIR 404 (Not Found)
GET https://api.hirall.com/api/search?q=JOHN 404 (Not Found)
```

## Root Cause

1. **Missing Backend Endpoint**: The `/api/search` route was never implemented in the backend
2. **Missing Environment Variable**: `NEXT_PUBLIC_API_URL` was not defined in `frontend/.env`
3. **Frontend API Call**: `searchAPI.globalSearch()` in `frontend/src/lib/api/search.ts` was calling a non-existent endpoint

## Solution Applied

### 1. Created Backend Search Endpoint ✅

**File**: `backend/src/controllers/search.controller.ts`
- Implements `globalSearch()` function
- Searches across multiple modules: staff, guests, bookings, orders, bills, transactions, receipts, payments
- Uses Supabase `.ilike` for case-insensitive partial matching
- Returns structured results with `type`, `display_name`, and `subtitle` for UI rendering
- Supports optional `modules` query parameter to filter search scope

**File**: `backend/src/routes/search.routes.ts`
- Registers `GET /search` route
- Requires authentication via `authenticate` middleware

**File**: `backend/src/routes/index.ts`
- Added `router.use('/search', searchRoutes)` to register the search endpoint

### 2. Fixed Environment Configuration ✅

**File**: `frontend/.env`
- Added `NEXT_PUBLIC_API_URL=http://localhost:5000` for local development

**File**: `frontend/.env.production` (NEW)
- Created production environment file
- Set `NEXT_PUBLIC_API_URL=https://api.hirall.com`
- Set `NEXT_PUBLIC_PYTHON_SERVICE_URL=https://services.hirall.com`

## API Endpoint Details

### Request
```
GET /api/search?q=QUERY&modules=staff,guest,order
```

**Query Parameters**:
- `q` (required): Search query string (minimum 2 characters)
- `modules` (optional): Comma-separated list of modules to search
  - Available: `staff`, `guest`, `order`, `booking`, `bill`, `transaction`, `receipt`, `payment`
  - Default: searches all modules

**Headers**:
- `Authorization: Bearer <token>` (required)
- `x-branch-id: <branch_id>` (optional, auto-injected by frontend)

### Response
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "staff",
      "display_name": "John Kipchirchir",
      "subtitle": "FGH001 - Manager",
      "first_name": "John",
      "last_name": "Kipchirchir",
      "staff_id": "FGH001",
      "email": "john@example.com",
      "phone": "+254712345678",
      "position": "Manager",
      "branch_id": 1
    },
    {
      "id": "uuid",
      "type": "guest",
      "display_name": "John Doe",
      "subtitle": "john.doe@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+254798765432",
      "id_number": "12345678"
    }
  ],
  "count": 2,
  "query": "john"
}
```

### Error Responses

**400 Bad Request** - Missing or invalid query:
```json
{
  "success": false,
  "error": "Search query is required"
}
```

**400 Bad Request** - Query too short:
```json
{
  "success": false,
  "error": "Search query must be at least 2 characters"
}
```

**401 Unauthorized** - Missing or invalid token:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Failed to perform search",
  "message": "Detailed error message"
}
```

## Search Behavior

### Staff Search
Searches in: `first_name`, `last_name`, `staff_id`, `email`, `phone`

### Guest Search
Searches in: `first_name`, `last_name`, `email`, `phone`, `id_number`

### Booking Search
Searches in: `booking_number`

### Order Search
Searches in: `order_number`

### Bill Search
Searches in: `bill_number`, `guest_name`

### Transaction Search
Searches in: `transaction_id`

### Receipt Search
Searches in: `receipt_number`

### Payment Search
Searches in: `payment_id`

## Testing

### Local Development
```bash
# Start backend
cd backend
npm run dev

# Start frontend
cd frontend
npm run dev

# Test search
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/search?q=john"
```

### Production
```bash
# Test search
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.hirall.com/api/search?q=john"
```

## Deployment Checklist

- [x] Backend search controller created
- [x] Backend search routes registered
- [x] Frontend environment variables configured
- [x] Production environment file created
- [ ] Backend deployed to production
- [ ] Frontend rebuilt and deployed
- [ ] Test search functionality in production

## Notes

- Search is **case-insensitive** (uses PostgreSQL `ILIKE`)
- Search performs **partial matching** (e.g., "john" matches "Johnson")
- Results are **limited to 10 per module** to prevent performance issues
- Search requires **authentication** - unauthenticated users will get 401
- Search respects **branch scoping** if `x-branch-id` header is provided

## Related Files

**Backend**:
- `backend/src/controllers/search.controller.ts` (NEW)
- `backend/src/routes/search.routes.ts` (NEW)
- `backend/src/routes/index.ts` (MODIFIED)

**Frontend**:
- `frontend/src/lib/api/search.ts` (EXISTING - no changes needed)
- `frontend/src/lib/api/core.ts` (EXISTING - no changes needed)
- `frontend/src/lib/config.ts` (EXISTING - no changes needed)
- `frontend/.env` (MODIFIED)
- `frontend/.env.production` (NEW)

## Status

✅ **COMPLETE** - Global search endpoint implemented and configured

---

**Fixed By**: Kiro AI Assistant  
**Date**: April 15, 2026  
**Issue**: 404 errors on `/api/search` endpoint  
**Solution**: Created missing backend endpoint and configured environment variables
