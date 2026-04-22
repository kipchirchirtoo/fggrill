# Mobile App Workflow Fixes Required

## Current Issues

The mobile app does NOT follow the same workflow as the web app. Here are the critical differences:

### 1. **Central Store Dashboard - WRONG WORKFLOW**
**Web App:** Shows navigation to Requisitions → Packing → Dispatch
**Mobile App:** Shows "Approved Requests" and "Create Dispatch" directly

**FIX NEEDED:**
- Remove "Approved Requests" button
- Remove "Create Dispatch" screen
- Add "Requisitions" screen (view/approve requests)
- Add "Packing Station" screen
- Add "Dispatch" screen (with READY/IN_TRANSIT/DELIVERED tabs)

### 2. **Branch Store Dashboard - MISSING FEATURES**
**Web App:** Has Requests, Stock, Receive Delivery tabs
**Mobile App:** Has similar structure but workflow may differ

**VERIFY:**
- Branch can create requisitions
- Branch can view their stock
- Branch can receive deliveries with OTP

### 3. **Dispatch Workflow - COMPLETELY WRONG**
**Web App Workflow:**
1. Branch creates requisition
2. Auditor reviews and approves
3. Central Store sees approved requests in "Requisitions" tab
4. Central Store packs items in "Packing Station"
5. Central Store creates dispatch in "Dispatch" tab
6. Dispatch shows in READY status
7. Central Store assigns vehicle/driver → moves to IN_TRANSIT
8. Branch receives with OTP → moves to DELIVERED

**Mobile App Current (WRONG):**
- Central Store can directly create dispatches
- No packing station
- No requisition approval workflow
- "Approved Requests" screen exists but shouldn't

### 4. **Missing Screens in Mobile App**
- Packing Station (Central Store)
- Proper Dispatch Management with tabs (Central Store)
- Requisition Review (Auditor role)

## Required Changes

### A. Central Store Module

#### 1. Remove These Screens:
- `ApprovedRequestsScreen.tsx` (doesn't exist in web workflow)
- `CreateDispatchScreen.tsx` (dispatch is created from packing, not standalone)

#### 2. Create These Screens:
- `RequisitionsScreen.tsx` - View all branch requests (PENDING/APPROVED/DISPATCHED)
- `PackingStationScreen.tsx` - Pack approved requests
- `DispatchManagementScreen.tsx` - Manage dispatches with tabs (READY/IN_TRANSIT/DELIVERED)

#### 3. Update Dashboard:
```typescript
// CSDashboardScreen.tsx
// REMOVE:
- "Approved Requests" button
- "Create Dispatch" button

// ADD:
- "Requisitions" button → RequisitionsScreen
- "Packing Station" button → PackingStationScreen
- "Dispatch" button → DispatchManagementScreen
- "Inventory" button → existing inventory screen
```

### B. Workflow Implementation

#### Requisitions Screen (Central Store)
- Show all branch requests
- Filter by status: ALL / PENDING / APPROVED / DISPATCHED / DELIVERED
- Auditor can approve/reject (if auditor role)
- Central Store can only view (cannot approve)
- Click request → show details
- If APPROVED → button "Go to Packing"

#### Packing Station Screen
- Show only APPROVED requests
- Select request
- Scan/enter items to pack
- Mark as packed
- Button "Create Dispatch" → creates dispatch note
- Redirect to Dispatch Management

#### Dispatch Management Screen
- Three tabs: READY / IN_TRANSIT / DELIVERED
- **READY tab:**
  - Shows dispatches ready to go
  - Button "Assign Vehicle & Driver"
  - After assignment → moves to IN_TRANSIT
- **IN_TRANSIT tab:**
  - Shows dispatches currently being delivered
  - Shows driver name, vehicle
  - Can print delivery note
- **DELIVERED tab:**
  - Shows completed deliveries
  - Filter by date/branch
  - Export PDF report

### C. Branch Store Module

#### Verify These Work:
1. Create Requisition
2. View Requisitions (with status)
3. Receive Delivery (with OTP verification)
4. View Stock

### D. Driver Module

#### Current Status: ✅ CORRECT
- Driver dashboard exists
- Can enter dispatch code
- GPS tracking
- This matches web app

### E. Auditor Module

#### Add Requisition Review:
- View all branch requisitions
- Approve/Reject with notes
- Adjust quantities if needed

## Implementation Priority

### Phase 1: Fix Central Store (CRITICAL)
1. Create RequisitionsScreen
2. Create PackingStationScreen  
3. Create DispatchManagementScreen
4. Update CSDashboardScreen navigation
5. Remove ApprovedRequestsScreen
6. Remove CreateDispatchScreen

### Phase 2: Verify Branch Store
1. Test requisition creation
2. Test receiving workflow
3. Ensure OTP verification works

### Phase 3: Add Auditor Features
1. Create AuditorRequisitionsScreen
2. Add approve/reject functionality

## API Endpoints Needed

### Already Exist (from web app):
- `GET /api/storekeeping/stock-requests` - Get all requests
- `POST /api/storekeeping/stock-requests/:id/review` - Approve/reject
- `GET /api/storekeeping/dispatch-notes` - Get dispatches
- `POST /api/dispatch/dispatches` - Create dispatch
- `POST /api/dispatch/dispatches/:id/dispatch` - Assign vehicle/driver

### May Need to Verify:
- Packing station endpoints
- Request status updates

## Summary

The mobile app currently allows Central Store to create dispatches directly, which bypasses the entire requisition → approval → packing workflow. This is WRONG and must be fixed to match the web app's workflow exactly.
