# Bugfix Design Document

## Technical Context

### Affected Components

**Backend:**
- File: `backend/src/routes/storekeeping/resources.routes.ts`
- Controller: `backend/src/controllers/storekeeping/resources.controller.ts` (already has `getSupplier` function)
- API Endpoint: `GET /api/store/suppliers/:id`

**Frontend:**
- Page: `frontend/src/app/dashboard/central-store/suppliers/[id]/page.tsx`
- Component: `frontend/src/app/dashboard/central-store/suppliers/[id]/PageContent.tsx`
- API Client: `frontend/src/lib/api.ts` (already configured correctly)

### Root Cause Analysis

The `getSupplier` controller function exists in `resources.controller.ts` (line 160) but is not:
1. Imported in the routes file
2. Registered as a GET handler for the `/suppliers/:id` route

Current route configuration:
```typescript
router.route('/suppliers/:id')
    .put(updateSupplier)
    .delete(deleteSupplier);
```

Missing: `.get(getSupplier)`

## Implementation Design

### Bug Condition

```pascal
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  RETURN request.method = "GET" AND 
         request.path MATCHES "/api/store/suppliers/:id" AND
         request.params.id IS_VALID_UUID
END FUNCTION
```

### Fix Specification

**Property: Fix Checking**
```pascal
FOR ALL request WHERE isBugCondition(request) DO
  response ← handleRequest'(request)
  ASSERT response.status = 200 AND
         response.body.success = true AND
         response.body.data.id = request.params.id AND
         response.body.data IS_FROM_TABLE "store_suppliers"
END FOR
```

**Property: Preservation Checking**
```pascal
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT handleRequest(request) = handleRequest'(request)
END FOR
```

### Solution

**Step 1: Import the getSupplier function**
Add `getSupplier` to the import statement in `resources.routes.ts`:
```typescript
import {
    getVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
    getSupplier,  // ADD THIS
    getSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier
} from '../../controllers/storekeeping/resources.controller';
```

**Step 2: Register the GET handler**
Update the route definition to include the GET handler:
```typescript
router.route('/suppliers/:id')
    .get(getSupplier)  // ADD THIS
    .put(updateSupplier)
    .delete(deleteSupplier);
```

### Validation Strategy

**Fix Validation:**
1. Navigate to `/dashboard/central-store/suppliers/[valid-supplier-id]`
2. Verify page loads without 404 error
3. Verify supplier profile data displays correctly
4. Verify all tabs (Overview, Orders & Deliveries, Financials, Ledger, Tax & Audit) load data

**Regression Prevention:**
1. Verify suppliers list page still works
2. Verify supplier creation still works
3. Verify supplier update still works
4. Verify supplier deletion still works
5. Verify other supplier-related pages (GRN, invoices, etc.) still work

### Test Cases

**Test Case 1: Valid Supplier ID**
- Input: GET `/api/store/suppliers/47151fed-8aea-426f-a47b-cecbc35c2fb1`
- Expected: 200 OK with supplier data

**Test Case 2: Invalid Supplier ID**
- Input: GET `/api/store/suppliers/invalid-uuid`
- Expected: 500 error with appropriate message

**Test Case 3: Non-existent Supplier ID**
- Input: GET `/api/store/suppliers/00000000-0000-0000-0000-000000000000`
- Expected: 500 error (Supabase .single() throws when no record found)

**Test Case 4: Supplier List (Regression)**
- Input: GET `/api/store/suppliers`
- Expected: 200 OK with array of suppliers

**Test Case 5: Supplier Update (Regression)**
- Input: PUT `/api/store/suppliers/[id]` with valid data
- Expected: 200 OK with updated supplier

**Test Case 6: Supplier Delete (Regression)**
- Input: DELETE `/api/store/suppliers/[id]`
- Expected: 200 OK with success message

## Risk Assessment

**Risk Level:** Low

**Justification:**
- Single-line code change (adding import and route handler)
- No database schema changes
- No business logic changes
- Controller function already exists and tested
- Frontend already expects this endpoint

**Potential Issues:**
- None identified - this is a straightforward routing fix

## Deployment Notes

- No database migrations required
- No environment variable changes
- Backend restart required after deployment
- No frontend changes required
