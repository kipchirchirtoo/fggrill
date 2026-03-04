# Kyogong Shift Float Endpoint 404 Fix - Design Document

## Overview

The Kyogong cash float tracking endpoint `/api/kyogong/shifts/:shift_id/float` returns 404 errors despite the route being registered and the controller function existing. Investigation reveals the route is properly mounted at `/api/kyogong` and the route definition uses `:shift_id` as the parameter name. The controller correctly extracts `shift_id` from `req.params`. The issue is likely related to route ordering, middleware configuration, or Express routing behavior where more specific routes need to be registered before parameterized routes.

The fix approach is to verify route ordering in the kyogong.routes.ts file, ensuring that the specific `/shifts/:shift_id/float` route is registered before the more general `/shifts/:id` route, and to add diagnostic logging to confirm the route is being registered correctly.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a GET request is made to `/api/kyogong/shifts/{shift_id}/float` with a valid shift ID
- **Property (P)**: The desired behavior - the request should be routed to the `getCurrentFloat` controller function and return float data
- **Preservation**: All other Kyogong endpoints must continue to work correctly, including `/shifts/current`, `/shifts/:id`, and float adjustment/history endpoints
- **getCurrentFloat**: The controller function in `backend/src/controllers/kyogong/float-tracking.controller.ts` that handles float data retrieval
- **kyogongRoutes**: The Express router in `backend/src/routes/kyogong.routes.ts` that defines all Kyogong-related routes
- **Route Ordering**: Express.js processes routes in the order they are registered; more specific routes must be registered before more general parameterized routes

## Bug Details

### Fault Condition

The bug manifests when a GET request is made to `/api/kyogong/shifts/{shift_id}/float` with a valid shift ID and proper authentication. The Express router fails to match the request to the registered route handler, resulting in a 404 error.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type HTTPRequest
  OUTPUT: boolean
  
  RETURN input.method == 'GET'
         AND input.path MATCHES '/api/kyogong/shifts/[valid-uuid]/float'
         AND input.headers.authorization IS_VALID
         AND routeExists('/shifts/:shift_id/float', kyogongRoutes)
         AND response.status == 404
END FUNCTION
```

### Examples

- **Example 1**: GET `/api/kyogong/shifts/60c1793d-8e80-42a0-b7a8-2910808f9a6c/float` → Expected: 200 with float data, Actual: 404 Not Found
- **Example 2**: GET `/api/kyogong/shifts/current` → Expected: 200 with current shift, Actual: 200 (works correctly)
- **Example 3**: GET `/api/kyogong/shifts/60c1793d-8e80-42a0-b7a8-2910808f9a6c` → Expected: 200 with shift details, Actual: 200 (works correctly)
- **Edge Case**: GET `/api/kyogong/shifts/60c1793d-8e80-42a0-b7a8-2910808f9a6c/float/history` → Expected: 200 with history, Actual: May also return 404 if route ordering is the issue

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- GET `/api/kyogong/shifts/current` must continue to return the current open shift
- GET `/api/kyogong/shifts/:id` must continue to return shift details
- POST `/api/kyogong/shifts/:shift_id/float/adjust` must continue to process float adjustments
- GET `/api/kyogong/shifts/:shift_id/float/history` must continue to return float history
- All other Kyogong endpoints (transactions, spa services, petty cash, etc.) must continue to work

**Scope:**
All requests that do NOT target the `/shifts/:shift_id/float` endpoint should be completely unaffected by this fix. This includes:
- All other shift management endpoints
- Transaction endpoints
- Sales point endpoints
- Authentication and authorization middleware behavior

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Route Ordering Conflict**: Express.js processes routes in registration order. The route `/shifts/:id` (line 145 in kyogong.routes.ts) may be matching before `/shifts/:shift_id/float` (line 189) because Express sees `/shifts/60c1793d-8e80-42a0-b7a8-2910808f9a6c/float` and matches it to `/shifts/:id` where `id = "60c1793d-8e80-42a0-b7a8-2910808f9a6c/float"`. The more specific route needs to be registered BEFORE the general parameterized route.

2. **Parameter Name Inconsistency**: While the route uses `:shift_id` and the controller extracts `shift_id`, there may be an Express routing issue where the parameter name with underscore is not being recognized correctly in certain Express versions.

3. **Middleware Interference**: The authorization middleware may be rejecting the request before it reaches the controller, though this would typically result in a 403, not a 404.

4. **Route Registration Failure**: The route may not be registering correctly due to a syntax error or Express configuration issue that's silently failing.

## Correctness Properties

Property 1: Fault Condition - Float Endpoint Returns Data

_For any_ GET request to `/api/kyogong/shifts/{shift_id}/float` where the shift_id is a valid UUID and the user is authenticated with appropriate role, the fixed routing configuration SHALL match the request to the getCurrentFloat controller function and return a 200 response with float data including currentFloat, openingFloat, expectedClosingCash, and lastUpdated.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Other Endpoints Unchanged

_For any_ request to Kyogong endpoints that is NOT targeting `/shifts/:shift_id/float`, the fixed routing configuration SHALL produce exactly the same routing behavior as the original configuration, preserving all existing endpoint functionality including shift management, transactions, and other services.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct (route ordering conflict):

**File**: `backend/src/routes/kyogong.routes.ts`

**Function**: Route registration order

**Specific Changes**:
1. **Reorder Float Routes**: Move all float-related routes (lines 189-233) to be registered BEFORE the general shift detail route `/shifts/:id` (line 145)
   - Move `/shifts/:shift_id/float` route to line ~140 (before `/shifts/:id`)
   - Move `/shifts/:shift_id/float/adjust` route to follow
   - Move `/shifts/:shift_id/float/history` route to follow
   - Move `/shifts/:shift_id/float/history/export` route to follow

2. **Add Route Registration Logging**: Add console.log statements to verify routes are being registered
   - Log when float routes are registered
   - Log the exact route patterns being registered

3. **Verify Parameter Naming**: Ensure consistency between route parameter (`:shift_id`) and controller extraction (`req.params.shift_id`)
   - Controller already correctly uses `shift_id`
   - Route definition already uses `:shift_id`
   - No changes needed here

4. **Test Route Matching**: Add a test endpoint or logging to verify Express is matching the route correctly
   - Temporarily add middleware before the route to log incoming requests
   - Verify the route pattern is being matched

5. **Alternative Fix (if ordering doesn't work)**: Use Express Router's ability to handle nested routes more explicitly
   - Create a sub-router for shift-specific routes
   - Mount float routes on the sub-router with clearer path definitions

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that make GET requests to the float endpoint with valid shift IDs and verify the response status and data. Run these tests on the UNFIXED code to observe 404 failures and understand the root cause.

**Test Cases**:
1. **Basic Float Fetch Test**: GET `/api/kyogong/shifts/{valid_shift_id}/float` with authentication (will fail with 404 on unfixed code)
2. **Float History Test**: GET `/api/kyogong/shifts/{valid_shift_id}/float/history` with authentication (may fail with 404 on unfixed code)
3. **Route Ordering Test**: Make requests to both `/shifts/:id` and `/shifts/:shift_id/float` to see which route matches (will show route conflict on unfixed code)
4. **Parameter Extraction Test**: Add logging to controller to see if it's ever reached (will show no logs on unfixed code, confirming routing issue)

**Expected Counterexamples**:
- 404 errors when requesting float data for valid shift IDs
- Possible causes: route ordering conflict, Express not matching the route pattern, middleware blocking the request

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := handleRequest_fixed(request)
  ASSERT response.status == 200
  ASSERT response.data.currentFloat IS_DEFINED
  ASSERT response.data.openingFloat IS_DEFINED
  ASSERT response.data.expectedClosingCash IS_DEFINED
  ASSERT response.data.lastUpdated IS_DEFINED
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed routing configuration produces the same result as the original configuration.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT handleRequest_original(request) = handleRequest_fixed(request)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for other Kyogong endpoints, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Shift Management Preservation**: Verify GET `/shifts/current`, GET `/shifts/:id`, POST `/shifts/open`, PUT `/shifts/:id/close` continue to work correctly
2. **Transaction Preservation**: Verify POST `/shifts/:shift_id/transactions`, GET `/shifts/:shift_id/transactions` continue to work correctly
3. **Other Endpoints Preservation**: Verify spa services, petty cash, sales points endpoints continue to work correctly
4. **Authorization Preservation**: Verify role-based access control continues to work for all endpoints

### Unit Tests

- Test float endpoint with valid shift ID returns 200 and correct data structure
- Test float endpoint with invalid shift ID returns 404
- Test float endpoint with closed shift returns 400
- Test float endpoint without authentication returns 401
- Test float endpoint with unauthorized role returns 403
- Test route ordering by making sequential requests to different shift endpoints

### Property-Based Tests

- Generate random valid shift IDs and verify float endpoint returns 200 with valid data structure
- Generate random requests to other Kyogong endpoints and verify they continue to work
- Generate random authorization scenarios and verify role-based access control works correctly
- Test that route matching is deterministic across many requests

### Integration Tests

- Test full flow: open shift → fetch float → make transaction → fetch float again → verify float updated
- Test switching between different shift endpoints in sequence
- Test that float endpoint works correctly in production-like environment with all middleware active
- Test concurrent requests to float endpoint and other shift endpoints
