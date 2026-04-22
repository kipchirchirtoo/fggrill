# Dispatch & Inventory Workflow System

## Overview
Complete auditable dispatch and inventory workflow system that enforces approval hierarchy and tracks all inventory movements from request to delivery.

## Core Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COMPLETE DISPATCH WORKFLOW                       │
└─────────────────────────────────────────────────────────────────────┘

1. BRANCH STORE KEEPER REQUEST
   ├─ Create request with items
   ├─ Status: PENDING_AUDIT
   └─ Notify: Auditor

2. AUDITOR REVIEW
   ├─ Review request details
   ├─ Approve/Reject/Adjust quantities
   ├─ Status: APPROVED or REJECTED
   └─ Notify: Branch Store Keeper + Central Store

3. CENTRAL STORE PROCESSING (Only for APPROVED requests)
   ├─ View approved requests
   ├─ Pick items
   ├─ Pack items
   ├─ Create dispatch (generates OTP)
   ├─ Status: DISPATCHED
   └─ Notify: Branch Store Keeper (with OTP)

4. DELIVERY & VERIFICATION
   ├─ Branch receives items
   ├─ Verify OTP
   ├─ Status: COMPLETED
   └─ Update branch stock
```

## Status Flow

```
PENDING_AUDIT → UNDER_REVIEW → APPROVED/REJECTED
                                    ↓
                                DISPATCHED
                                    ↓
                                COMPLETED
```

## Key Constraints

### Business Rules
- ❌ Central store CANNOT create standalone dispatches
- ❌ Central store CANNOT bypass auditor approval
- ❌ Dispatch CANNOT be completed without valid OTP
- ✅ Every dispatch MUST link to an approved request
- ✅ OTP MUST expire after defined duration
- ✅ OTP MUST be single-use only
- ✅ All actions MUST be role-based

### Role Permissions

**Branch Store Keeper:**
- Create stock requests
- View own branch requests
- Verify OTP on delivery
- View dispatch history

**Auditor:**
- View all pending requests
- Approve/reject requests
- Adjust quantities
- View audit trail

**Central Store Keeper:**
- View approved requests only
- Create dispatches from approved requests
- View dispatch history
- Cannot modify request status

## Database Schema

### Existing Tables (Already Implemented)
- `stock_requests` - Main request table
- `stock_request_items` - Request line items
- `store_dispatches` - Dispatch records
- `store_dispatch_items` - Dispatch line items

### New Table Required: `dispatch_otps`

```sql
CREATE TABLE dispatch_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES store_dispatches(id) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id),
  is_used BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dispatch_otps_dispatch ON dispatch_otps(dispatch_id);
CREATE INDEX idx_dispatch_otps_code ON dispatch_otps(otp_code);
CREATE INDEX idx_dispatch_otps_expires ON dispatch_otps(expires_at);
```

## API Endpoints

### Stock Requests
- `POST /api/storekeeping/stock-requests` - Create request (Branch)
- `GET /api/storekeeping/stock-requests` - List requests (Role-based)
- `GET /api/storekeeping/stock-requests/:id` - Get request details
- `PUT /api/storekeeping/stock-requests/:id/review` - Review request (Auditor)
- `PUT /api/storekeeping/stock-requests/:id/approve` - Approve request (Auditor)
- `PUT /api/storekeeping/stock-requests/:id/reject` - Reject request (Auditor)

### Dispatches
- `GET /api/dispatch/approved-requests` - List approved requests (Central)
- `POST /api/dispatch/dispatches` - Create dispatch from request (Central)
- `GET /api/dispatch/dispatches` - List dispatches (Role-based)
- `GET /api/dispatch/dispatches/:id` - Get dispatch details
- `POST /api/dispatch/dispatches/:id/verify-otp` - Verify OTP (Branch)
- `GET /api/dispatch/dispatches/:id/otp` - Get OTP (Central/Branch)

## OTP Implementation Strategy

### Generation
- 6-digit numeric code
- Cryptographically secure random generation
- Unique per dispatch
- Generated at dispatch creation

### Expiry
- Default: 24 hours from generation
- Configurable per dispatch
- Automatic cleanup of expired OTPs

### Verification
- Maximum 3 attempts
- Single-use only
- Must match dispatch_id
- Must not be expired
- Must not be already used

### Security
- OTP stored hashed in database
- Rate limiting on verification attempts
- Audit log of all verification attempts
- Notification on failed attempts

## Mobile App Screens

### 1. Branch Store Keeper Screens

**Request Creation Screen**
- Item selection from catalog
- Quantity input
- Priority selection (ROUTINE, URGENT)
- Reason/notes
- Submit button

**My Requests Screen**
- List of all requests
- Status badges
- Filter by status
- Pull to refresh

**Request Detail Screen**
- Request information
- Items list
- Status history
- Auditor notes
- Dispatch tracking (if dispatched)

**OTP Verification Screen**
- 6-digit OTP input
- Verify button
- Resend OTP option
- Dispatch details

### 2. Auditor Screens

**Pending Requests Screen**
- List of PENDING_AUDIT requests
- Priority indicators
- Branch information
- Quick actions

**Request Review Screen**
- Request details
- Items with quantities
- Approve/Reject buttons
- Quantity adjustment
- Notes input
- Branch performance metrics

**Audit History Screen**
- All reviewed requests
- Filter by status/branch
- Search functionality

### 3. Central Store Screens

**Approved Requests Screen**
- List of APPROVED requests
- Waiting for dispatch
- Priority sorting
- Branch information

**Create Dispatch Screen**
- Request details
- Items to dispatch
- Vehicle selection
- Driver selection
- Generate dispatch button

**Dispatch List Screen**
- All dispatches
- Status tracking
- OTP display
- Filter by status/branch

**Dispatch Detail Screen**
- Dispatch information
- Items list
- OTP code (if not verified)
- Delivery status
- Verification timestamp

## Testing Checklist

### Backend Tests
- [ ] OTP generation creates unique codes
- [ ] OTP expiry validation works
- [ ] OTP verification succeeds with valid code
- [ ] OTP verification fails with invalid code
- [ ] OTP verification fails after expiry
- [ ] OTP verification fails after max attempts
- [ ] OTP cannot be reused
- [ ] Dispatch creation generates OTP
- [ ] Dispatch cannot be created without approved request
- [ ] Request approval workflow enforces roles
- [ ] Branch isolation works correctly

### Mobile App Tests
- [ ] Branch keeper can create requests
- [ ] Branch keeper cannot see other branches' requests
- [ ] Auditor can see all pending requests
- [ ] Auditor can approve/reject requests
- [ ] Central store sees only approved requests
- [ ] Central store can create dispatches
- [ ] OTP verification works on mobile
- [ ] OTP verification shows proper error messages
- [ ] Status updates reflect in real-time
- [ ] Notifications work for all roles

### Integration Tests
- [ ] End-to-end workflow from request to delivery
- [ ] Role-based access control enforced
- [ ] Notifications sent at each stage
- [ ] Stock updates correctly after verification
- [ ] Audit trail is complete

## Success Metrics
- Zero orphan dispatches
- 100% OTP verification rate
- Complete audit trail for all movements
- Role-based access enforced
- Average request-to-delivery time < 24 hours
