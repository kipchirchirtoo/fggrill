# Procurement Purchase Orders 405 Fix - Bugfix Design

## Overview

The branch accounting purchases page is experiencing a 405 Method Not Allowed error when attempting to POST to the purchase orders endpoint. This is caused by URL malformation where the API base URL is being treated as a relative path and concatenated with the current page URL. The fix involves replacing the local `API_URL` constant with the properly normalized `API_URL` from `@/lib/config`, following the same pattern used to fix the Kyogong 404 issue.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the purchases page attempts to POST to the purchase orders endpoint using a locally defined API_URL constant
- **Property (P)**: The desired behavior - the POST request should use the normalized API_URL and successfully reach the backend endpoint
- **Preservation**: Existing functionality using procurementAPI methods must remain unchanged
- **API_URL**: The normalized API base URL exported from `@/lib/config` that includes proper protocol handling
- **normalizeUrl**: The function in `@/lib/config` that ensures URLs have the correct protocol prefix (http:// or https://)
- **NEXT_PUBLIC_API_URL**: The environment variable that may or may not include a protocol prefix

## Bug Details

### Fault Condition

The bug manifests when the purchases page attempts to create a purchase order via POST request. The page uses a local `API_URL` constant defined as `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'` instead of importing the normalized `API_URL` from `@/lib/config`. When `NEXT_PUBLIC_API_URL` is set to `api.hirall.com` (without protocol), the browser treats it as a relative path.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { apiUrl: string, currentPageUrl: string }
  OUTPUT: boolean
  
  RETURN NOT input.apiUrl.startsWith('http://') 
         AND NOT input.apiUrl.startsWith('https://')
         AND input.apiUrl IS used_in_fetch_call
         AND browser_treats_as_relative_path(input.apiUrl)
END FUNCTION
```

### Examples

- **Production POST Request**: When creating a purchase order in production, the URL becomes `https://famousgate.hirall.com/dashboard/branch-accounting/api.hirall.com/api/procurement/purchase-orders` instead of `https://api.hirall.com/api/procurement/purchase-orders`, resulting in 405 Method Not Allowed
- **Development Environment**: In development with localhost, the local constant works correctly because it includes the protocol: `http://localhost:5000/api/procurement/purchase-orders`
- **Other API Calls**: Calls using `procurementAPI.getPurchaseOrders()` work correctly because they use the normalized API_URL from `@/lib/api`
- **Edge Case**: If `NEXT_PUBLIC_API_URL` is set to `https://api.hirall.com` (with protocol), the bug doesn't manifest, but this is inconsistent with the environment configuration

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Existing API calls using `procurementAPI` and `storeAPI` methods must continue to work correctly
- Other pages that import and use `API_URL` from `@/lib/config` must continue to construct correct URLs
- Development mode with localhost URLs must continue to use http:// protocol correctly
- Desktop/Electron environment must continue to use correct API URLs for the proxy

**Scope:**
All inputs that do NOT involve the direct POST request to `/api/procurement/purchase-orders` using the local API_URL constant should be completely unaffected by this fix. This includes:
- GET requests for purchase orders (using procurementAPI)
- GET requests for invoices (using procurementAPI)
- GET requests for suppliers (using storeAPI)
- GET requests for items (using storeAPI)
- All other API calls in the purchases page that use the imported API methods

## Hypothesized Root Cause

Based on the bug description and the previous Kyogong fix, the root cause is:

1. **Local API_URL Constant**: The purchases page defines its own `API_URL` constant at line 27 using `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'`

2. **Missing Protocol Normalization**: The local constant doesn't go through the `normalizeUrl` function in `@/lib/config`, which adds the correct protocol prefix when missing

3. **Browser Relative Path Interpretation**: When `NEXT_PUBLIC_API_URL` is set to `api.hirall.com` without a protocol, the browser interprets it as a relative path and concatenates it with the current page URL

4. **Inconsistent Pattern**: The page already imports and uses `procurementAPI` and `storeAPI` from `@/lib/api` (which use the normalized API_URL), but the POST request at line 164 uses the local constant directly

## Correctness Properties

Property 1: Fault Condition - Purchase Order POST Request Uses Normalized URL

_For any_ POST request to create a purchase order where the API_URL is used to construct the endpoint URL, the fixed code SHALL use the normalized API_URL from `@/lib/config` that includes the correct protocol prefix, resulting in a properly formatted absolute URL that successfully reaches the backend endpoint.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing API Method Calls Unchanged

_For any_ API call that uses the `procurementAPI` or `storeAPI` methods (GET requests for orders, invoices, suppliers, items), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for these API interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`

**Specific Changes**:
1. **Remove Local API_URL Constant**: Delete line 27 that defines `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';`

2. **Add Import for Normalized API_URL**: Add `API_URL` to the existing import from `@/lib/config` or create a new import statement:
   ```typescript
   import { API_URL } from '@/lib/config';
   ```

3. **Verify Fetch Call**: Ensure the fetch call at line 164 continues to use `${API_URL}/api/procurement/purchase-orders` (no change needed to the actual fetch call, just the source of API_URL)

4. **No Other Changes Required**: The rest of the file already uses the correct pattern with `procurementAPI` and `storeAPI` methods

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that the local API_URL constant causes URL malformation in production.

**Test Plan**: Inspect the network requests in the browser when attempting to create a purchase order. Run these tests on the UNFIXED code to observe the malformed URL and 405 error.

**Test Cases**:
1. **Production POST Request**: Attempt to create a purchase order in production environment (will fail with 405 on unfixed code)
2. **Development POST Request**: Attempt to create a purchase order in development with localhost (may work on unfixed code due to protocol in default value)
3. **URL Construction Inspection**: Log the constructed URL before the fetch call to verify it's malformed (will show concatenated path on unfixed code)
4. **Environment Variable Check**: Verify `NEXT_PUBLIC_API_URL` value and whether it includes protocol (will show missing protocol in production)

**Expected Counterexamples**:
- POST request URL is `https://famousgate.hirall.com/dashboard/branch-accounting/api.hirall.com/api/procurement/purchase-orders` instead of `https://api.hirall.com/api/procurement/purchase-orders`
- Backend returns 405 Method Not Allowed because the malformed URL doesn't match any route
- Possible causes: missing protocol in environment variable, no URL normalization, browser treating URL as relative path

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL request WHERE request.method = 'POST' AND request.endpoint = '/api/procurement/purchase-orders' DO
  url := constructUrl_fixed(API_URL, request.endpoint)
  ASSERT url.startsWith('http://') OR url.startsWith('https://')
  ASSERT url = 'https://api.hirall.com/api/procurement/purchase-orders' (in production)
  ASSERT url = 'http://localhost:5000/api/procurement/purchase-orders' (in development)
  response := fetch(url, request.options)
  ASSERT response.status IN [200, 201, 400, 401, 403] (not 404 or 405)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL request WHERE request.uses_procurementAPI OR request.uses_storeAPI DO
  ASSERT request_behavior_original = request_behavior_fixed
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different API methods
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy API calls

**Test Plan**: Observe behavior on UNFIXED code first for GET requests using procurementAPI and storeAPI, then write property-based tests capturing that behavior.

**Test Cases**:
1. **GET Purchase Orders Preservation**: Verify that fetching purchase orders using `procurementAPI.getPurchaseOrders()` continues to work correctly after fix
2. **GET Invoices Preservation**: Verify that fetching invoices using `procurementAPI.getInvoices()` continues to work correctly after fix
3. **GET Suppliers Preservation**: Verify that fetching suppliers using `storeAPI.getSuppliers()` continues to work correctly after fix
4. **GET Items Preservation**: Verify that fetching items using `storeAPI.getItems()` continues to work correctly after fix

### Unit Tests

- Test that API_URL is imported from `@/lib/config` and not defined locally
- Test that the POST request constructs the correct absolute URL
- Test that the URL includes the correct protocol (http:// or https://)
- Test that the URL matches the expected production or development endpoint

### Property-Based Tests

- Generate random environment configurations (with/without protocol) and verify URL normalization works correctly
- Generate random API endpoints and verify they all construct valid absolute URLs
- Test that all API method calls (procurementAPI, storeAPI) continue to work across many scenarios

### Integration Tests

- Test full purchase order creation flow in production environment
- Test full purchase order creation flow in development environment
- Test that all GET requests for orders, invoices, suppliers, and items continue to work
- Test that the fix works correctly in desktop/Electron environment
