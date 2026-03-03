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
