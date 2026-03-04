# Bugfix Requirements Document

## Introduction

The Kyogong cash float tracking system's frontend component is unable to fetch float data from the backend API endpoint `/api/kyogong/shifts/{shift_id}/float`, resulting in repeated 404 errors. The endpoint handler exists in the controller and is registered in the routes file, but requests are not reaching the handler. This prevents cashiers from viewing current float balances, opening floats, and transaction history during their shifts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the frontend component FloatDisplay fetches float data using `/api/kyogong/shifts/{shift_id}/float` THEN the system returns a 404 error indicating the route is not found

1.2 WHEN a valid shift ID (e.g., 60c1793d-8e80-42a0-b7a8-2910808f9a6c) is used in the request THEN the system still returns 404 instead of returning float data

1.3 WHEN the error occurs THEN the console logs show "Failed to load resource: the server responded with a status of 404" and "Error fetching float: Error: Failed to fetch float data"

### Expected Behavior (Correct)

2.1 WHEN the frontend component fetches float data using `/api/kyogong/shifts/{shift_id}/float` with a valid shift ID THEN the system SHALL return a 200 response with float data including currentFloat, openingFloat, expectedClosingCash, and lastUpdated

2.2 WHEN the shift ID exists and the shift is in OPEN or ACTIVE status THEN the system SHALL successfully route the request to the getCurrentFloat controller function

2.3 WHEN the request is made with proper authentication THEN the system SHALL process the request through the authorization middleware and reach the controller handler

### Unchanged Behavior (Regression Prevention)

3.1 WHEN other Kyogong endpoints are called (e.g., `/api/kyogong/shifts/current`, `/api/kyogong/shifts/:id`) THEN the system SHALL CONTINUE TO return successful responses

3.2 WHEN float adjustment requests are made to `/api/kyogong/shifts/:shift_id/float/adjust` THEN the system SHALL CONTINUE TO process them correctly

3.3 WHEN float history requests are made to `/api/kyogong/shifts/:shift_id/float/history` THEN the system SHALL CONTINUE TO return history data successfully

3.4 WHEN authentication and authorization checks are performed on Kyogong routes THEN the system SHALL CONTINUE TO enforce role-based access control correctly
