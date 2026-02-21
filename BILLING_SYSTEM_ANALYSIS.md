# Billing System Analysis & Implementation Plan

## Executive Summary

Your codebase has a **restaurant order system** but lacks a proper **unified billing system** that supports:
- Multiple orders on a single bill
- Partial payments
- Split bills (by items, amount, guest)
- Bill status management (OPEN → PAID)
- Kenyan VAT calculations
- Multi-department orders (Kitchen, Bar, Pool Bar, Spa)

## Current State Analysis

### What EXISTS ✅

1. **Restaurant Orders** (`restaurant_orders` table)
   - Individual orders with items
   - Order status tracking (pending, confirmed, preparing, ready, delivered, cancelled)
   - Payment status (pending, paid, refunded)
   - Table/room assignment
   - Total amount calculation

2. **Split Bill Infrastructure** (Partially implemented)
   - `restaurant_bill_splits` table exists
   - `restaurant_split_payments` table exists
   - Split types: equal, by_item, by_guest, custom
   - BUT: No controller/API implementation found

3. **Payment Processing**
   - M-Pesa integration
   - Paystack integration
   - Cash, Card, Bank Transfer support
   - Payment tracking in `finance_payments` table

4. **Multi-Department Support**
   - Restaurant orders
   - Bar orders (separate module)
   - Pool table tokens
   - Room service

### What's MISSING ❌

1. **Unified Bill Entity**
   - No single "bill" that can hold multiple orders over time
   - Current system: 1 order = 1 bill (no consolidation)
   - Cannot add drinks to existing food order

2. **Bill Status Management**
   - No OPEN/CLOSED/PAID bill lifecycle
   - Orders are independent, not grouped
   - No "bill remains open until fully paid" logic

3. **Partial Payment Handling**
   - No balance tracking per bill
   - No "multiple payments against one bill" support
   - No overpayment prevention

4. **Bill Locking Rules**
   - No enforcement of "paid bills cannot be edited"
   - No partial payment deletion prevention

5. **Kenyan VAT Calculations**
   - No VAT rate configuration (Kenya uses 16% VAT)
   - No VAT breakdown on bills
   - No VAT reporting

6. **Split Bill API**
   - Tables exist but no controllers
   - No frontend integration
   - No split-by-guest/seat functionality

7. **Audit Trail**
   - Limited audit logging for bill modifications
   - No comprehensive payment reversal tracking

## Proposed Solution Architecture

### 1. Bill Entity (New Core Concept)

```sql
CREATE TABLE restaurant_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT UNIQUE NOT NULL,
  branch_id INTEGER REFERENCES branches(id),
  
  -- Customer Info
  table_number TEXT,
  room_number TEXT,
  guest_id UUID REFERENCES users(id),
  guest_name TEXT,
  
  -- Bill Status
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, CLOSED, PAID, CANCELLED
  
  -- Financial
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- VAT Configuration
  vat_rate DECIMAL(5, 2) DEFAULT 16.00, -- Kenya VAT
  vat_inclusive BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_amounts CHECK (
    subtotal >= 0 AND
    vat_amount >= 0 AND
    total_amount >= 0 AND
    paid_amount >= 0 AND
    paid_amount <= total_amount AND
    balance = total_amount - paid_amount
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('OPEN', 'CLOSED', 'PAID', 'CANCELLED')
  )
);
```

### 2. Link Orders to Bills

```sql
-- Add bill_id to existing restaurant_orders
ALTER TABLE restaurant_orders 
ADD COLUMN bill_id UUID REFERENCES restaurant_bills(id);

-- Add department tracking
ALTER TABLE restaurant_orders
ADD COLUMN department TEXT DEFAULT 'restaurant'; -- restaurant, bar, pool_bar, spa

CREATE INDEX idx_orders_bill ON restaurant_orders(bill_id);
```

### 3. Bill Payments (Multiple payments per bill)

```sql
CREATE TABLE restaurant_bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES restaurant_bills(id) NOT NULL,
  
  -- Payment Details
  payment_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method TEXT NOT NULL, -- CASH, MPESA, CARD, BANK_TRANSFER
  payment_reference TEXT, -- M-Pesa code, card transaction ID
  
  -- Audit
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by UUID REFERENCES users(id),
  cashier_id UUID REFERENCES staff_profiles(id),
  
  -- Reversal
  reversed BOOLEAN DEFAULT false,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID REFERENCES users(id),
  reversal_reason TEXT,
  
  CONSTRAINT valid_amount CHECK (amount > 0)
);
```

### 4. Enhanced Split Bills

```sql
-- Parent bill for split scenarios
ALTER TABLE restaurant_bill_splits
ADD COLUMN parent_bill_id UUID REFERENCES restaurant_bills(id);

-- Child bills created from splits
CREATE TABLE restaurant_bill_split_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_bill_id UUID REFERENCES restaurant_bills(id) NOT NULL,
  child_bill_id UUID REFERENCES restaurant_bills(id) NOT NULL,
  split_type TEXT NOT NULL, -- by_items, by_amount, by_guest, by_seat
  guest_number INTEGER,
  seat_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5. VAT Calculation Functions

```sql
CREATE OR REPLACE FUNCTION calculate_bill_vat(
  p_bill_id UUID
) RETURNS VOID AS $$
DECLARE
  v_subtotal DECIMAL(12, 2);
  v_vat_rate DECIMAL(5, 2);
  v_vat_amount DECIMAL(12, 2);
  v_total DECIMAL(12, 2);
BEGIN
  -- Get bill details
  SELECT subtotal, vat_rate INTO v_subtotal, v_vat_rate
  FROM restaurant_bills
  WHERE id = p_bill_id;
  
  -- Calculate VAT (Kenya: 16%)
  v_vat_amount := v_subtotal * (v_vat_rate / 100);
  v_total := v_subtotal + v_vat_amount;
  
  -- Update bill
  UPDATE restaurant_bills
  SET 
    vat_amount = v_vat_amount,
    total_amount = v_total,
    balance = v_total - paid_amount,
    updated_at = NOW()
  WHERE id = p_bill_id;
END;
$$ LANGUAGE plpgsql;
```

## Implementation Checklist

### Phase 1: Database Schema (Priority: CRITICAL)

- [ ] Create `restaurant_bills` table
- [ ] Add `bill_id` to `restaurant_orders`
- [ ] Create `restaurant_bill_payments` table
- [ ] Create `restaurant_bill_split_children` table
- [ ] Add VAT fields to bills
- [ ] Create VAT calculation functions
- [ ] Create bill status update triggers
- [ ] Create payment balance update triggers
- [ ] Add indexes for performance

### Phase 2: Backend API (Priority: HIGH)

- [ ] **Bill Management Controller**
  - `POST /api/restaurant/bills` - Create new bill
  - `GET /api/restaurant/bills/:id` - Get bill details
  - `GET /api/restaurant/bills/open` - List open bills
  - `PUT /api/restaurant/bills/:id/close` - Close bill (no more orders)
  - `POST /api/restaurant/bills/:id/orders` - Add order to existing bill
  
- [ ] **Payment Controller**
  - `POST /api/restaurant/bills/:id/payments` - Record payment
  - `GET /api/restaurant/bills/:id/payments` - Get payment history
  - `POST /api/restaurant/bills/:id/payments/:paymentId/reverse` - Reverse payment
  
- [ ] **Split Bill Controller**
  - `POST /api/restaurant/bills/:id/split/by-items` - Split by items
  - `POST /api/restaurant/bills/:id/split/by-amount` - Split by amount
  - `POST /api/restaurant/bills/:id/split/by-guest` - Split by guest/seat
  
- [ ] **VAT Controller**
  - `GET /api/restaurant/vat-rates` - Get VAT configuration
  - `PUT /api/restaurant/vat-rates` - Update VAT rate (admin only)

### Phase 3: Business Logic (Priority: HIGH)

- [ ] **Bill Lifecycle Management**
  - Enforce OPEN → CLOSED → PAID transitions
  - Prevent edits to PAID bills
  - Lock bills when payment_status = 'PAID'
  
- [ ] **Payment Validation**
  - Prevent overpayments
  - Calculate balance after each payment
  - Auto-update bill status when fully paid
  
- [ ] **Multi-Order Support**
  - Allow multiple orders on same bill
  - Track order timestamps
  - Track which waiter added each order
  
- [ ] **Department Integration**
  - Link restaurant, bar, pool bar, spa orders to same bill
  - Department-wise revenue split for reporting
  - Unified customer view

### Phase 4: Frontend Integration (Priority: MEDIUM)

- [ ] **Bill Search UI**
  - Search by table number
  - Search by room number
  - Search by guest name
  - List all open bills
  
- [ ] **Add to Existing Bill Flow**
  - Select open bill
  - Add menu items
  - Show order history
  - Display updated total
  
- [ ] **Payment UI**
  - Multiple payment methods
  - Partial payment support
  - Balance display
  - Payment history
  
- [ ] **Split Bill UI**
  - Split by items (drag-drop)
  - Split by amount (equal/custom)
  - Split by guest/seat
  - Generate child bills

### Phase 5: Audit & Compliance (Priority: MEDIUM)

- [ ] **Audit Logging**
  - Log all bill modifications
  - Log all payments
  - Log all splits
  - Log all reversals
  
- [ ] **VAT Reporting**
  - Daily VAT summary
  - Monthly VAT report
  - VAT breakdown by department
  
- [ ] **Payment Audit Trail**
  - M-Pesa transaction verification
  - Card payment reconciliation
  - Cash handling reports

### Phase 6: Offline Mode (Priority: LOW)

- [ ] Sync bill data to SQLite
- [ ] Queue bill modifications
- [ ] Queue payments
- [ ] Conflict resolution on sync

## Key Business Rules

### 1. Bill Status Transitions

```
OPEN → Can add orders, cannot pay
CLOSED → Cannot add orders, can pay
PAID → Cannot modify, fully paid
CANCELLED → Cannot modify, voided
```

### 2. Payment Rules

- Multiple payments allowed per bill
- Total payments cannot exceed bill total
- Partial payments keep bill OPEN or CLOSED
- Full payment changes status to PAID
- Paid bills cannot accept new payments (except reversals)

### 3. Edit Restrictions

- OPEN bills: Can add orders, modify items
- CLOSED bills: Cannot add orders, cannot modify items
- PAID bills: Locked, no modifications
- Partial payments: Cannot be deleted, only reversed

### 4. Split Bill Rules

- Only OPEN or CLOSED bills can be split
- PAID bills cannot be split
- Split creates child bills
- Parent bill marked as split
- Child bills inherit VAT rate

### 5. VAT Calculation

- Kenya VAT: 16% (configurable)
- Applied at bill closure
- Shown separately on receipt
- Included in total amount

## Migration Strategy

### Step 1: Create New Tables (Non-Breaking)
- Add new tables without modifying existing ones
- Run migration on test environment first

### Step 2: Backfill Data
- Create bills from existing orders (1 order = 1 bill initially)
- Preserve all existing data
- Mark migrated records

### Step 3: Deploy Backend API
- New endpoints available
- Old endpoints still work
- Gradual migration

### Step 4: Update Frontend
- Feature flag for new billing system
- A/B testing
- Rollback capability

### Step 5: Deprecate Old System
- Monitor usage
- Fix issues
- Full cutover

## Testing Requirements

### Unit Tests
- Bill creation
- Order addition
- Payment processing
- VAT calculation
- Split bill logic

### Integration Tests
- Multi-order workflow
- Partial payment flow
- Split bill flow
- Department integration

### Property-Based Tests
- Payment balance always correct
- VAT calculation accuracy
- No overpayments possible
- Bill status transitions valid

## Security Considerations

1. **Authorization**
   - Only waiters can create bills
   - Only cashiers can process payments
   - Only managers can reverse payments
   - Only admins can modify VAT rates

2. **Audit Trail**
   - All modifications logged
   - User ID tracked
   - Timestamps recorded
   - Immutable audit log

3. **Data Integrity**
   - Foreign key constraints
   - Check constraints on amounts
   - Transaction isolation
   - Rollback on errors

## Performance Optimization

1. **Indexes**
   - bill_number (unique)
   - status + branch_id
   - table_number + status
   - room_number + status
   - created_at (for date range queries)

2. **Caching**
   - Open bills list
   - VAT rates
   - Menu items

3. **Query Optimization**
   - Eager load orders with bills
   - Batch payment processing
   - Materialized views for reports

## Next Steps

1. **Review this analysis** with your team
2. **Prioritize features** based on business needs
3. **Create detailed tasks** in your project management tool
4. **Start with Phase 1** (Database Schema)
5. **Implement incrementally** with testing at each phase

## Questions to Answer

1. Should bills auto-close after X hours of inactivity?
2. What's the maximum number of partial payments allowed?
3. Should we support bill merging (combine 2 bills)?
4. What's the VAT rate for different item categories?
5. Should service charge be automatic or manual?
6. What's the policy for payment reversals?
7. Who can void/cancel bills?
8. Should we support bill printing/PDF generation?

---

**Status**: Analysis Complete - Ready for Implementation
**Estimated Effort**: 3-4 weeks (full-stack team)
**Risk Level**: Medium (requires careful migration)
