# Kyogong Branch Shift-Based POS System - Complete Analysis & Implementation Plan

## Executive Summary
This document outlines the complete implementation of a shift-controlled, multi-point POS system for Kyogong Branch with 4 distinct cashier stations, petty cash management, and secure data flow from Cashiers → Branch Accountant → Auditors.

---

## 1. CURRENT SYSTEM ANALYSIS

### Existing Infrastructure
✅ **Already Implemented:**
- Basic cashier module at `/dashboard/cashier`
- Restaurant POS system
- Bar POS system
- Payment processing (Cash, M-Pesa, Card)
- Receipt generation
- Transaction logging
- Branch-based data segregation
- Role-based access control
- Audit trails

❌ **Missing Components:**
- Shift management system
- Multiple sales point support
- Cashier-specific POS terminals
- Staff assignment to shifts
- Shift reconciliation workflow
- Petty cash ledger
- SPA services billing
- Pool token inventory
- Dynamic service billing
- Variance tracking and approval
- Accountant review workflow
- Shift-to-shift data flow

---

## 2. SYSTEM ARCHITECTURE

### 2.1 Sales Points Structure

```
KYOGONG BRANCH
├── SPA CASHIER (Point 1)
│   ├── Massage
│   ├── Waxing
│   ├── Nail Parlour
│   ├── Saloon
│   ├── Sauna
│   └── Kinyozi
│
├── EXECUTIVE BAR CASHIER (Point 2)
│   ├── Bar Sales
│   ├── Restaurant Sales
│   └── Assigned Waiters/Bartenders
│
├── SPORTS BAR CASHIER (Point 3)
│   ├── Bar Sales
│   ├── Restaurant Sales
│   ├── Pool Tokens
│   └── Assigned Waiters/Bartenders
│
└── RECEPTION/OVERALL CASHIER (Point 4 - Master)
    ├── Restaurant Sales
    ├── Car Wash
    ├── Swimming Pool
    ├── Bouncing Castle
    ├── Rooms
    ├── Conference
    ├── Quadbikes
    └── Petty Cash Management
```

### 2.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CASHIER LAYER                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │   SPA    │  │Executive │  │  Sports  │  │Reception ││
│  │ Cashier  │  │   Bar    │  │   Bar    │  │ Cashier  ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│
│       │             │              │              │      │
│       └─────────────┴──────────────┴──────────────┘      │
│                          │                               │
│                    [Shift Close]                         │
│                          ↓                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                    [Auto-Submit]
                           ↓
┌─────────────────────────────────────────────────────────┐
│              BRANCH ACCOUNTANT LAYER                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • Review all shifts                               │ │
│  │  • Verify reconciliations                          │ │
│  │  • Approve/Flag variances                          │ │
│  │  │  Review petty cash                              │ │
│  │  • Lock daily reports                              │ │
│  └────────────────────┬───────────────────────────────┘ │
│                       │                                  │
│                 [Daily Lock]                             │
│                       ↓                                  │
└───────────────────────┼──────────────────────────────────┘
                        │
                  [Read-Only]
                        ↓
┌─────────────────────────────────────────────────────────┐
│                  AUDITOR LAYER                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  • View all shifts (all branches)                  │ │
│  │  • Analyze variances                               │ │
│  │  • Export reports                                  │ │
│  │  • Flag anomalies                                  │ │
│  │  • No modification rights                          │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 3. DATABASE SCHEMA DESIGN

### 3.1 Core Tables

#### A. Sales Points Table
```sql
CREATE TABLE sales_points (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    code TEXT UNIQUE NOT NULL, -- 'SPA', 'EXEC_BAR', 'SPORTS_BAR', 'RECEPTION'
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    requires_staff_assignment BOOLEAN DEFAULT FALSE,
    supports_petty_cash BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kyogong Branch Sales Points
INSERT INTO sales_points (branch_id, code, name, requires_staff_assignment, supports_petty_cash) VALUES
(2, 'SPA', 'SPA Cashier', FALSE, FALSE),
(2, 'EXEC_BAR', 'Executive Bar Cashier', TRUE, FALSE),
(2, 'SPORTS_BAR', 'Sports Bar Cashier', TRUE, FALSE),
(2, 'RECEPTION', 'Reception/Overall Cashier', FALSE, TRUE);
```

#### B. Shifts Table
```sql
CREATE TABLE cashier_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_number TEXT UNIQUE NOT NULL, -- Auto-generated: KYG-SPA-20260218-001
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    sales_point_id INTEGER REFERENCES sales_points(id) NOT NULL,
    cashier_id UUID REFERENCES users(id) NOT NULL,
    
    -- Shift timing
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Opening balances
    opening_cash_float DECIMAL(10,2) NOT NULL DEFAULT 0,
    opening_petty_cash DECIMAL(10,2) DEFAULT 0,
    
    -- Closing balances
    closing_cash_counted DECIMAL(10,2),
    closing_petty_cash DECIMAL(10,2),
    
    -- Sales summary
    total_sales DECIMAL(10,2) DEFAULT 0,
    cash_sales DECIMAL(10,2) DEFAULT 0,
    mpesa_sales DECIMAL(10,2) DEFAULT 0,
    card_sales DECIMAL(10,2) DEFAULT 0,
    
    -- Reconciliation
    cash_expected DECIMAL(10,2),
    cash_variance DECIMAL(10,2),
    variance_reason TEXT,
    
    -- Status
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'RECONCILED', 'APPROVED', 'FLAGGED')),
    
    -- Approval workflow
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_shift_times CHECK (closed_at IS NULL OR closed_at > opened_at)
);

CREATE INDEX idx_shifts_branch ON cashier_shifts(branch_id);
CREATE INDEX idx_shifts_cashier ON cashier_shifts(cashier_id);
CREATE INDEX idx_shifts_status ON cashier_shifts(status);
CREATE INDEX idx_shifts_opened_at ON cashier_shifts(opened_at);
```

#### C. Shift Staff Assignment
```sql
CREATE TABLE shift_staff_assignments (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) NOT NULL,
    staff_role TEXT NOT NULL, -- 'WAITER', 'BARTENDER', 'SERVICE_STAFF'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(shift_id, staff_id)
);
```

#### D. SPA Services Catalog
```sql
CREATE TABLE spa_services (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    category TEXT NOT NULL, -- 'MASSAGE', 'WAXING', 'NAIL', 'SALOON', 'SAUNA', 'KINYOZI'
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample SPA services
INSERT INTO spa_services (branch_id, category, name, base_price, duration_minutes) VALUES
(2, 'MASSAGE', 'Full Body Massage', 2500, 60),
(2, 'MASSAGE', 'Back Massage', 1500, 30),
(2, 'WAXING', 'Full Body Waxing', 3000, 90),
(2, 'WAXING', 'Leg Waxing', 1000, 30),
(2, 'NAIL', 'Manicure', 800, 45),
(2, 'NAIL', 'Pedicure', 1000, 45),
(2, 'SALOON', 'Hair Cut (Ladies)', 500, 30),
(2, 'SALOON', 'Hair Styling', 1500, 60),
(2, 'SAUNA', 'Sauna Session', 1000, 30),
(2, 'KINYOZI', 'Hair Cut (Gents)', 300, 20),
(2, 'KINYOZI', 'Shave', 200, 15);
```

#### E. Pool Tokens Inventory
```sql
CREATE TABLE pool_tokens_inventory (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    shift_id UUID REFERENCES cashier_shifts(id),
    
    -- Token tracking
    opening_balance INTEGER NOT NULL DEFAULT 0,
    tokens_received INTEGER DEFAULT 0,
    tokens_sold INTEGER DEFAULT 0,
    tokens_issued INTEGER DEFAULT 0, -- Complimentary/promotional
    closing_balance INTEGER,
    variance INTEGER,
    variance_reason TEXT,
    
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_id, shift_id)
);
```

#### F. Petty Cash Ledger
```sql
CREATE TABLE petty_cash_ledger (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    shift_id UUID REFERENCES cashier_shifts(id),
    
    -- Transaction details
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    amount DECIMAL(10,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('CASH_IN', 'CASH_OUT')),
    
    -- Purpose details
    purpose_category TEXT NOT NULL, -- 'REPAIRS', 'MAINTENANCE', 'FUEL', 'TRANSPORT', 'SUPPLIES', 'OTHER'
    purpose_description TEXT NOT NULL,
    
    -- Recipient details
    paid_to_name TEXT,
    paid_to_id_number TEXT,
    
    -- Authorization
    authorized_by UUID REFERENCES users(id),
    authorizer_name TEXT,
    
    -- Supporting documents
    receipt_number TEXT,
    receipt_attachment_url TEXT,
    
    -- Audit
    recorded_by UUID REFERENCES users(id) NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_petty_cash_branch ON petty_cash_ledger(branch_id);
CREATE INDEX idx_petty_cash_shift ON petty_cash_ledger(shift_id);
CREATE INDEX idx_petty_cash_date ON petty_cash_ledger(transaction_date);
```

#### G. Dynamic Services (Car Wash, Quadbikes, etc.)
```sql
CREATE TABLE dynamic_services (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    service_type TEXT NOT NULL, -- 'CAR_WASH', 'SWIMMING', 'BOUNCING_CASTLE', 'QUADBIKE'
    name TEXT NOT NULL,
    pricing_model TEXT NOT NULL, -- 'FIXED', 'TIME_BASED', 'VEHICLE_TYPE'
    base_price DECIMAL(10,2) NOT NULL,
    price_per_hour DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample dynamic services
INSERT INTO dynamic_services (branch_id, service_type, name, pricing_model, base_price, price_per_hour) VALUES
(2, 'CAR_WASH', 'Saloon Car Wash', 'VEHICLE_TYPE', 500, NULL),
(2, 'CAR_WASH', 'SUV/4x4 Wash', 'VEHICLE_TYPE', 800, NULL),
(2, 'SWIMMING', 'Swimming Pool Entry', 'FIXED', 300, NULL),
(2, 'BOUNCING_CASTLE', 'Bouncing Castle', 'TIME_BASED', 500, 200),
(2, 'QUADBIKE', 'Quadbike Rental', 'TIME_BASED', 1000, 500);
```

#### H. Shift Transactions (Unified)
```sql
CREATE TABLE shift_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) NOT NULL,
    branch_id INTEGER REFERENCES branches(id) NOT NULL,
    sales_point_id INTEGER REFERENCES sales_points(id) NOT NULL,
    
    -- Transaction details
    transaction_number TEXT UNIQUE NOT NULL,
    transaction_type TEXT NOT NULL, -- 'SALE', 'REFUND', 'VOID'
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Service/Product details
    service_category TEXT, -- 'SPA', 'BAR', 'RESTAURANT', 'POOL_TOKEN', 'DYNAMIC_SERVICE', 'ROOM', 'CONFERENCE'
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Payment
    payment_method TEXT NOT NULL, -- 'CASH', 'MPESA', 'CARD', 'MIXED'
    cash_amount DECIMAL(10,2) DEFAULT 0,
    mpesa_amount DECIMAL(10,2) DEFAULT 0,
    card_amount DECIMAL(10,2) DEFAULT 0,
    mpesa_reference TEXT,
    
    -- Customer details
    customer_name TEXT,
    customer_phone TEXT,
    customer_room_number TEXT,
    
    -- Staff
    served_by UUID REFERENCES users(id),
    
    -- Authorization (for voids/discounts)
    requires_authorization BOOLEAN DEFAULT FALSE,
    authorized_by UUID REFERENCES users(id),
    authorization_reason TEXT,
    
    -- Audit
    is_voided BOOLEAN DEFAULT FALSE,
    void_reason TEXT,
    voided_by UUID REFERENCES users(id),
    voided_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shift_trans_shift ON shift_transactions(shift_id);
CREATE INDEX idx_shift_trans_branch ON shift_transactions(branch_id);
CREATE INDEX idx_shift_trans_date ON shift_transactions(transaction_date);
```

#### I. Shift Transaction Items
```sql
CREATE TABLE shift_transaction_items (
    id SERIAL PRIMARY KEY,
    transaction_id UUID REFERENCES shift_transactions(id) ON DELETE CASCADE,
    
    -- Item details
    item_type TEXT NOT NULL, -- 'SPA_SERVICE', 'MENU_ITEM', 'POOL_TOKEN', 'DYNAMIC_SERVICE'
    item_id TEXT, -- Reference to spa_services, menu_items, etc.
    item_name TEXT NOT NULL,
    
    -- Pricing
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Service staff (for SPA)
    service_staff_id UUID REFERENCES users(id),
    service_staff_name TEXT,
    
    -- Additional details
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 4. ROLE & PERMISSION MATRIX

| Role | Open Shift | Sell | Close Shift | Edit Sales | View Own Shifts | View All Shifts | Approve Shifts | Petty Cash |
|------|-----------|------|-------------|------------|----------------|----------------|---------------|------------|
| **Waiter/Bartender** | ❌ | ✅ (assigned shift only) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **SPA Cashier** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Executive Bar Cashier** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Sports Bar Cashier** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Reception Cashier** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Branch Accountant** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (branch) | ✅ | ✅ (view) |
| **Auditor** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (all) | ❌ | ✅ (view) |
| **Super Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. SHIFT LIFECYCLE WORKFLOW

### 5.1 Opening a Shift

```
1. Cashier logs in
2. Selects sales point
3. System checks: No open shift exists for this point
4. Cashier enters:
   - Opening cash float
   - Opening petty cash (Reception only)
5. System generates shift number: KYG-SPA-20260218-001
6. For Executive/Sports Bar: Assign waiters/bartenders
7. Shift status: OPEN
8. Cashier can now process sales
```

### 5.2 During Shift

```
- All sales tagged with shift_id
- Real-time running totals updated
- Waiters/bartenders can create bills (if assigned)
- Only cashier can accept payments
- Voids/discounts require authorization
- Petty cash entries recorded (Reception only)
```

### 5.3 Closing a Shift

```
1. Cashier initiates close
2. System calculates:
   - Total sales by category
   - Payment breakdown (Cash/M-Pesa/Card)
   - Expected cash = Opening float + Cash sales
3. Cashier counts physical cash
4. System calculates variance
5. If variance > threshold: Mandatory explanation required
6. Pool tokens reconciliation (Sports Bar)
7. Petty cash reconciliation (Reception)
8. System blocks closure until all reconciled
9. Shift status: CLOSED
10. Auto-submit to Branch Accountant
```

### 5.4 Accountant Review

```
1. Accountant views all closed shifts
2. Reviews:
   - Variances
   - Void reasons
   - Petty cash usage
3. Can:
   - Approve shift
   - Flag for investigation
   - Add review notes
4. Shift status: APPROVED or FLAGGED
```

### 5.5 Auditor Access

```
1. Read-only access to all shifts
2. Can filter by:
   - Branch
   - Sales point
   - Date range
   - Status
3. Export reports
4. Flag anomalies (no modification)
```

---

## 6. SECURITY & AUDIT CONTROLS

### 6.1 Immutability Rules
- ✅ No sales without open shift
- ✅ No deletion of closed shifts
- ✅ No backdating transactions
- ✅ No editing after shift close
- ✅ All edits logged with reason, user, timestamp

### 6.2 Audit Trail
```sql
CREATE TABLE shift_audit_log (
    id SERIAL PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id),
    action TEXT NOT NULL, -- 'OPEN', 'CLOSE', 'APPROVE', 'FLAG', 'VOID', 'DISCOUNT'
    performed_by UUID REFERENCES users(id) NOT NULL,
    reason TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 6.3 Variance Alerts
- Automatic alerts when:
  - Cash variance > 5%
  - Pool token variance > 0
  - Petty cash discrepancy
  - Excessive voids/discounts
  - Shift duration > 12 hours

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Database & Backend (Week 1-2)
- ✅ Create all database tables
- ✅ Implement shift management API
- ✅ Build sales point configuration
- ✅ Create petty cash ledger API
- ✅ Implement SPA services catalog
- ✅ Build pool token tracking
- ✅ Create dynamic services billing

### Phase 2: Cashier POS Interfaces (Week 3-4)
- ✅ SPA Cashier POS
- ✅ Executive Bar Cashier POS
- ✅ Sports Bar Cashier POS
- ✅ Reception/Overall Cashier POS
- ✅ Shift open/close workflows
- ✅ Staff assignment interface

### Phase 3: Reconciliation & Reporting (Week 5)
- ✅ Shift reconciliation screens
- ✅ Variance tracking
- ✅ Petty cash management UI
- ✅ Pool token reconciliation

### Phase 4: Accountant & Auditor Interfaces (Week 6)
- ✅ Branch Accountant dashboard
- ✅ Shift review workflow
- ✅ Approval/flagging system
- ✅ Auditor read-only access
- ✅ Export functionality

### Phase 5: Testing & Deployment (Week 7)
- ✅ End-to-end testing
- ✅ User training
- ✅ Data migration
- ✅ Go-live support

---

## 8. API ENDPOINTS REQUIRED

### Shifts
- `POST /api/shifts/open` - Open new shift
- `GET /api/shifts/current` - Get current open shift
- `PUT /api/shifts/:id/close` - Close shift
- `POST /api/shifts/:id/reconcile` - Submit reconciliation
- `GET /api/shifts` - List shifts (filtered by role)
- `GET /api/shifts/:id` - Get shift details
- `PUT /api/shifts/:id/approve` - Approve shift (Accountant)
- `PUT /api/shifts/:id/flag` - Flag shift (Accountant)

### Sales Points
- `GET /api/sales-points` - List sales points
- `GET /api/sales-points/:id` - Get sales point details

### Transactions
- `POST /api/shifts/:id/transactions` - Create transaction
- `GET /api/shifts/:id/transactions` - List shift transactions
- `PUT /api/transactions/:id/void` - Void transaction
- `POST /api/transactions/:id/refund` - Process refund

### SPA Services
- `GET /api/spa-services` - List SPA services
- `POST /api/spa-services` - Create SPA service
- `PUT /api/spa-services/:id` - Update SPA service

### Petty Cash
- `POST /api/petty-cash` - Record petty cash entry
- `GET /api/petty-cash` - List petty cash entries
- `GET /api/petty-cash/summary` - Get petty cash summary

### Pool Tokens
- `POST /api/pool-tokens/reconcile` - Reconcile pool tokens
- `GET /api/pool-tokens/inventory` - Get token inventory

### Reports
- `GET /api/reports/shift-summary` - Shift summary report
- `GET /api/reports/daily-sales` - Daily sales report
- `GET /api/reports/variance-analysis` - Variance analysis
- `GET /api/reports/petty-cash` - Petty cash report

---

## 9. UI/UX REQUIREMENTS

### 9.1 Cashier POS Interface
- Large touch-friendly buttons
- Quick service/product selection
- Real-time running total
- Payment method toggle
- Receipt preview
- Shift status indicator
- Running sales summary

### 9.2 Shift Management
- Clear open/close workflow
- Visual reconciliation form
- Variance calculator
- Mandatory fields validation
- Confirmation dialogs

### 9.3 Accountant Dashboard
- Shift queue (pending review)
- Variance highlights
- Quick approve/flag actions
- Drill-down to transaction details
- Notes/comments system

### 9.4 Auditor Interface
- Advanced filtering
- Export to Excel/PDF
- Anomaly detection highlights
- Trend analysis charts
- Cross-shift comparison

---

## 10. NEXT STEPS

1. **Review & Approval**: Stakeholder review of this specification
2. **Database Migration**: Create migration files for all new tables
3. **Backend Development**: Implement API endpoints
4. **Frontend Development**: Build POS interfaces
5. **Testing**: Comprehensive testing with real scenarios
6. **Training**: Train cashiers, accountants, auditors
7. **Deployment**: Phased rollout starting with one sales point
8. **Monitoring**: Track system performance and user feedback

---

**Document Status:** ✅ ANALYSIS COMPLETE
**Next Action:** Begin Phase 1 - Database & Backend Implementation
**Estimated Timeline:** 7 weeks for full implementation
**Priority:** HIGH - Critical for revenue control and accountability
