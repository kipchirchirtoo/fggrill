# Branch Payment Verification System - Specification

## Overview
Complete payment verification workflow from cashier → branch accountant → auditor with banking records integration.

## Requirements

### 1. Payment Recording (Cashier Level)
**Who**: Cashiers at branch
**What**: Record all payments made at the branch
**Details Required**:
- Payment amount
- Payment method (Cash, M-Pesa, Card, Bank Transfer, Cheque)
- Reference number (M-Pesa code, card transaction ID, cheque number, etc.)
- Customer/Guest name
- Bill/Order reference
- Date & time
- Branch identification
- Cashier who recorded it

### 2. Payment Verification (Branch Accountant)
**Who**: Branch Accountant
**What**: Verify all payments recorded by cashiers
**Page**: `/dashboard/branch-accounting/payments`
**Features**:
- View all unverified payments from branch
- See payment details:
  - Amount
  - Payment method
  - Reference number
  - Customer name
  - Bill/Order reference
  - Cashier who recorded
  - Date & time
- Click on payment to see full details
- Verify payment (mark as confirmed)
- Add verification notes
- After verification, payment goes to auditor queue

### 3. Banking Records (Branch Accountant)
**Who**: Branch Accountant
**What**: Record bank deposits and reconcile with payments
**Page**: `/dashboard/branch-accounting/banking` (already exists)
**Features Needed**:
- Record banking transaction
  - Bank name
  - Account number
  - Deposit amount
  - Bank reference/slip number
  - Date of deposit
  - Notes
- View all banking records
- Match banking records with verified payments
- Export banking report

### 4. Auditor Verification
**Who**: Auditor
**What**: Final verification of accountant-confirmed payments
**Page**: `/dashboard/auditor/payments` or similar
**Features**:
- View all accountant-verified payments
- See full audit trail:
  - Original cashier record
  - Accountant verification
  - Banking records (if applicable)
- Approve or flag for review
- Add auditor notes

## Database Schema Needed

### payments table
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- Cash, M-Pesa, Card, Bank Transfer, Cheque
    reference_number VARCHAR(100), -- M-Pesa code, card transaction ID, etc.
    customer_name VARCHAR(255),
    bill_reference VARCHAR(100), -- Bill number, order number, etc.
    bill_id UUID, -- Link to actual bill if exists
    
    -- Cashier info
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Accountant verification
    accountant_verified_by UUID REFERENCES users(id),
    accountant_verified_at TIMESTAMP WITH TIME ZONE,
    accountant_notes TEXT,
    
    -- Auditor verification
    auditor_verified_by UUID REFERENCES users(id),
    auditor_verified_at TIMESTAMP WITH TIME ZONE,
    auditor_notes TEXT,
    auditor_status VARCHAR(20), -- approved, flagged, pending
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, accountant_verified, auditor_verified, flagged
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### banking_transactions table (may already exist)
```sql
CREATE TABLE banking_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id INTEGER NOT NULL REFERENCES branches(id),
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50),
    deposit_amount DECIMAL(10, 2) NOT NULL,
    bank_reference VARCHAR(100) NOT NULL, -- Slip number, transaction ID
    deposit_date DATE NOT NULL,
    notes TEXT,
    
    recorded_by UUID NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Reconciliation
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Endpoints Needed

### Payment Endpoints
- `GET /api/payments?branch_id=X&status=pending` - Get payments for verification
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments` - Record new payment (cashier)
- `PUT /api/payments/:id/verify-accountant` - Accountant verification
- `PUT /api/payments/:id/verify-auditor` - Auditor verification
- `GET /api/payments/stats` - Payment statistics

### Banking Endpoints
- `GET /api/banking?branch_id=X` - Get banking transactions
- `POST /api/banking` - Record banking transaction
- `PUT /api/banking/:id/reconcile` - Mark as reconciled
- `GET /api/banking/unreconciled` - Get unreconciled deposits

## UI Components Needed

### 1. Payment List Component
- Table showing all payments
- Filters: status, date range, payment method
- Search by reference, customer name
- Status badges (pending, verified, flagged)

### 2. Payment Detail Modal
- Full payment information
- Audit trail (who recorded, who verified, when)
- Verification buttons
- Notes section

### 3. Banking Record Modal
- Form to record bank deposit
- Bank selection
- Amount and reference
- Date picker

### 4. Banking List Component
- Table of all banking transactions
- Reconciliation status
- Match with payments

## Workflow

1. **Cashier** records payment when customer pays
   - Status: `pending`
   
2. **Branch Accountant** reviews payments
   - Views all pending payments
   - Clicks to see details
   - Verifies payment is legitimate
   - Adds notes if needed
   - Clicks "Verify Payment"
   - Status: `accountant_verified`
   
3. **Branch Accountant** records banking
   - When money is deposited to bank
   - Records bank name, amount, reference
   - Links to verified payments if possible
   
4. **Auditor** final verification
   - Views all accountant-verified payments
   - Reviews audit trail
   - Checks banking records match
   - Approves or flags for review
   - Status: `auditor_verified` or `flagged`

## Priority Implementation Order

1. ✅ Database schema (payments table)
2. ✅ Backend API endpoints
3. ✅ Branch Accountant payments page (enhanced)
4. ✅ Payment detail modal
5. ✅ Banking records integration (already exists, enhance)
6. ⏳ Auditor verification page
7. ⏳ Cashier payment recording (integrate with existing cashier flow)

## Notes

- This is a comprehensive financial control system
- Requires proper RLS policies for security
- Audit trail is critical - never delete, only flag
- All timestamps must be immutable
- Payment methods must be standardized
- Reference numbers are critical for reconciliation

## Estimated Complexity
**High** - This is a multi-role, multi-step workflow with financial implications

## Next Steps
1. Create database migration
2. Create backend controllers
3. Create frontend pages
4. Test workflow end-to-end
5. Add reporting and analytics
