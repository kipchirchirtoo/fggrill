# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Purchase Order POST Request URL Malformation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For this deterministic bug, scope the property to the concrete failing case: POST request to purchase orders endpoint in production environment
  - Test that POST request to `/api/procurement/purchase-orders` constructs a properly formatted absolute URL (from Fault Condition in design)
  - The test assertions should verify:
    - URL starts with `http://` or `https://` (not treated as relative path)
    - URL equals `https://api.hirall.com/api/procurement/purchase-orders` in production
    - URL equals `http://localhost:5000/api/procurement/purchase-orders` in development
    - Response status is NOT 405 Method Not Allowed
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found:
    - Malformed URL: `https://famousgate.hirall.com/dashboard/branch-accounting/api.hirall.com/api/procurement/purchase-orders`
    - 405 Method Not Allowed error
    - Root cause: local API_URL constant without protocol normalization
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing API Method Calls Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for API calls using procurementAPI and storeAPI methods:
    - `procurementAPI.getPurchaseOrders()` successfully fetches purchase orders
    - `procurementAPI.getInvoices()` successfully fetches invoices
    - `storeAPI.getSuppliers()` successfully fetches suppliers
    - `storeAPI.getItems()` successfully fetches items
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - For all GET requests using procurementAPI methods, verify successful responses
    - For all GET requests using storeAPI methods, verify successful responses
    - For all API calls NOT using the local API_URL constant, verify correct URL construction
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for Purchase Orders 405 Method Not Allowed Error

  - [x] 3.1 Implement the fix
    - Remove the local API_URL constant at line 27 in `frontend/src/app/dashboard/branch-accounting/purchases/page.tsx`
    - Add import for normalized API_URL from `@/lib/config`: `import { API_URL } from '@/lib/config';`
    - Verify the fetch call at line 164 continues to use `${API_URL}/api/procurement/purchase-orders`
    - No changes needed to existing procurementAPI and storeAPI method calls
    - _Bug_Condition: isBugCondition(input) where input.apiUrl does NOT start with 'http://' or 'https://' AND is used in fetch call AND browser treats as relative path_
    - _Expected_Behavior: POST request constructs correct absolute URL using normalized API_URL from config, resulting in successful backend endpoint access_
    - _Preservation: Existing API calls using procurementAPI and storeAPI methods must continue to work correctly; other pages using API_URL from config must continue to construct correct URLs; development and desktop environments must continue to use correct protocols_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Purchase Order POST Request Uses Normalized URL
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify POST request URL is correctly formatted as absolute URL
    - Verify response status is NOT 405 Method Not Allowed
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing API Method Calls Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all GET requests using procurementAPI and storeAPI methods still work correctly
    - Confirm no regressions in development or desktop environments

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
