# Bugfix Requirements Document

## Introduction

The Kyogong shift POS system endpoints are returning 404 errors when accessed from the frontend. The routes are defined in `backend/src/routes/kyogong.routes.ts` and properly mounted in `backend/src/routes/index.ts` as `/kyogong`, which should make them accessible at `/api/kyogong/*`. However, the endpoints `/api/kyogong/shifts/current` and `/api/kyogong/sales-points?is_active=true` are returning 404 errors and HTML responses instead of JSON, indicating the routes are not being registered or the server is not properly handling these requests.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a frontend client makes a GET request to `/api/kyogong/shifts/current` THEN the system returns a 404 error

1.2 WHEN a frontend client makes a GET request to `/api/kyogong/sales-points?is_active=true` THEN the system returns a 404 error

1.3 WHEN the sales-points endpoint is accessed THEN the system returns HTML content (likely an error page) instead of JSON

1.4 WHEN the browser console logs the error THEN it shows "Failed to load resource: the server responded with a status of 404 ()" and "SyntaxError: Unexpected token '<', '<!DOCTYPE '... is not valid JSON"

### Expected Behavior (Correct)

2.1 WHEN a frontend client makes a GET request to `/api/kyogong/shifts/current` with valid authentication THEN the system SHALL return a 200 status with JSON containing the current open shift for the authenticated user or null if no shift is open

2.2 WHEN a frontend client makes a GET request to `/api/kyogong/sales-points?is_active=true` with valid authentication THEN the system SHALL return a 200 status with JSON containing an array of active sales points for the user's branch

2.3 WHEN any Kyogong API endpoint is accessed THEN the system SHALL return JSON responses with appropriate content-type headers

2.4 WHEN authentication or authorization fails THEN the system SHALL return appropriate 401 or 403 status codes with JSON error messages, not HTML

### Unchanged Behavior (Regression Prevention)

3.1 WHEN other API routes (non-Kyogong) are accessed THEN the system SHALL CONTINUE TO function correctly and return appropriate responses

3.2 WHEN the Kyogong routes are accessed with invalid authentication THEN the system SHALL CONTINUE TO enforce authentication and authorization rules

3.3 WHEN the database tables for Kyogong (shifts, sales_points, etc.) are queried directly THEN the system SHALL CONTINUE TO return data correctly

3.4 WHEN other middleware (protect, authorize) is applied to routes THEN the system SHALL CONTINUE TO function correctly for all routes


## Root Cause Analysis

The 404 errors were caused by Kyogong components using `process.env.NEXT_PUBLIC_API_URL` directly instead of importing the `API_URL` constant from `@/lib/config`. 

The `config.ts` file has normalization logic that ensures the API URL is properly formatted with the correct protocol (http:// or https://). When components bypass this and use the raw environment variable, they can get malformed URLs.

In production builds, if `NEXT_PUBLIC_API_URL` is set to just `api.hirall.com` (without protocol), the browser treats it as a relative path and concatenates it with the current page URL, resulting in malformed URLs like:
`https://famousgate.hirall.com/dashboard/kyogong/api.hirall.com/api/kyogong/shifts/current`

The backend routes were correctly configured and working - the issue was entirely on the frontend side with how the API URLs were being constructed.

## Solution

Updated all Kyogong components to import and use `API_URL` from `@/lib/config` instead of `process.env.NEXT_PUBLIC_API_URL`:

1. `frontend/src/components/kyogong/KyogongPOSLayout.tsx` - Added import and replaced 2 API calls
2. `frontend/src/components/kyogong/ShiftOpener.tsx` - Added import and replaced 2 API calls
3. `frontend/src/components/kyogong/ShiftCloser.tsx` - Added import and replaced 1 API call
4. `frontend/src/components/kyogong/SaleForm.tsx` - Added import and replaced 2 API calls
5. `frontend/src/components/kyogong/PettyCashModal.tsx` - Added import and replaced 1 API call
6. `frontend/src/components/kyogong/ServiceFormModal.tsx` - Added import and replaced 1 API call
7. `frontend/src/app/dashboard/admin/kyogong/services/page.tsx` - Added import and replaced 2 API calls

This ensures all API calls go through the proper URL normalization logic, which:
- Adds the correct protocol (http:// or https://) if missing
- Removes trailing slashes
- Handles localhost vs production URLs correctly
- Provides fallback to default production URLs when needed

## Testing Instructions

1. Start the backend dev server: `cd backend && npm run dev`
2. Start the frontend dev server: `cd frontend && npm run dev`
3. Navigate to the Kyogong POS pages (Spa, Executive Bar, Sports Bar, Reception)
4. Verify that:
   - Sales points load correctly
   - Current shift status loads without 404 errors
   - Shift opening works
   - Transaction recording works
   - Shift closing works
   - No console errors about malformed URLs

## Deployment Notes

For production deployment, ensure `NEXT_PUBLIC_API_URL` is set to the full URL with protocol:
- Correct: `NEXT_PUBLIC_API_URL=https://api.hirall.com`
- Incorrect: `NEXT_PUBLIC_API_URL=api.hirall.com`

However, even if the environment variable is set incorrectly, the normalization logic in `config.ts` will now handle it properly.
