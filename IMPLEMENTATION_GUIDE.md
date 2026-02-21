# Unified Billing System - Implementation Guide

## Overview

This guide provides step-by-step instructions to implement the unified billing system that supports:
- ✅ Multiple orders on a single OPEN bill
- ✅ Partial payments with balance tracking
- ✅ Split bills (by items, amount, guest, seat)
- ✅ Bill status management (OPEN → CLOSED → PAID)
- ✅ Kenyan VAT calculations (16%)
- ✅ Multi-department support (Kitchen, Bar, Pool Bar, Spa)
- ✅ Full audit trails
- ✅ Payment reversals
- ✅ Overpayment prevention

## Files Created

### 1. Database Migration
**File**: `backend/supabase/migrations/25_unified_billing_system.sql`
- Creates `restaurant_bills` table
- Creates `restaurant_bill_payments` table
- Creates `restaurant_bill_audit_log` table
- Adds `bill_id` to `restaurant_orders`
- Implements VAT calculation functions
- Implements automatic bill status updates
- Implements payment balance tracking

### 2. Backend Controller
**File**: `backend/src/controllers/restaurant-bills.controller.ts`
- `createBill()` - Create new bill
- `getBillDetails()` - Get bill with orders and payments
- `searchOpenBills()` - Search for open bills
- `addOrderToBill()` - Add order to existing bill
- `closeBill()` - Close bill (ready for payment)
- `recordPayment()` - Record payment with overpayment prevention
- `getPaymentHistory()` - Get all payments for a bill
- `reversePayment()` - Reverse payment (manager only)
- `splitBillByItems()` - Split bill by items
- `getBillAuditLog()` - Get audit trail
- `getOpenBills()` - List all open bills

### 3. Backend Routes
**File**: `backend/src/routes/restaurant-bills.routes.ts`
- Defines all API endpoints
- Implements role-based access control
- Maps routes to controller functions

### 4. Analysis Document
**File**: `BILLING_SYSTEM_ANALYSIS.md`
- Current state analysis
- Gap analysis
- Proposed solution architecture
- Implementation checklist
- Business rules
- Migration strategy

## Implementation Steps

### Phase 1: Database Setup (Day 1)

#### Step 1.1: Run Migration

```bash
# Navigate to backend directory
cd backend

# Run the migration
npx supabase migration up
```

Or if using direct SQL:

```bash
psql -h your-supabase-host -U postgres -d postgres -f supabase/migrations/25_unified_billing_system.sql
```

#### Step 1.2: Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'restaurant_bill%';

-- Should return:
-- restaurant_bills
-- restaurant_bill_payments
-- restaurant_bill_audit_log
```

#### Step 1.3: Test Functions

```sql
-- Test bill number generation
SELECT generate_bill_number();
-- Should return: BILL2602180001 (format: BILLYYMMDDNNNN)

-- Test payment number generation
SELECT generate_payment_number();
-- Should return: PAY2602180001
```

### Phase 2: Backend API Setup (Day 2-3)

#### Step 2.1: Register Routes

Edit `backend/src/app.ts` or `backend/src/server.ts`:

```typescript
import restaurantBillsRoutes from './routes/restaurant-bills.routes';

// Add after existing routes
app.use('/api/restaurant/bills', restaurantBillsRoutes);
```

#### Step 2.2: Test API Endpoints

```bash
# Start backend server
npm run dev

# Test create bill
curl -X POST http://localhost:5000/api/restaurant/bills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "table_number": "T-05",
    "guest_name": "John Doe",
    "branch_id": 1
  }'

# Test search open bills
curl -X POST http://localhost:5000/api/restaurant/bills/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "OPEN",
    "branch_id": 1
  }'
```

### Phase 3: Data Migration (Day 3-4)

#### Step 3.1: Migrate Existing Orders to Bills

Create migration script `backend/scripts/migrate-orders-to-bills.ts`:

```typescript
import { supabase } from '../src/config/supabase';

async function migrateOrdersToBills() {
  console.log('Starting migration of orders to bills...');

  // Get all existing orders without bill_id
  const { data: orders, error } = await supabase
    .from('restaurant_orders')
    .select('*')
    .is('bill_id', null);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Found ${orders.length} orders to migrate`);

  for (const order of orders) {
    try {
      // Generate bill number
      const { data: billNumber } = await supabase.rpc('generate_bill_number');

      // Create bill for this order
      const { data: bill, error: billError } = await supabase
        .from('restaurant_bills')
        .insert([{
          bill_number: billNumber,
          branch_id: order.branch_id,
          table_number: order.table_number,
          room_number: order.room_number,
          guest_id: order.guest_id,
          status: order.payment_status === 'paid' ? 'PAID' : 'OPEN',
          subtotal: order.total_amount,
          total_amount: order.total_amount,
          paid_amount: order.payment_status === 'paid' ? order.total_amount : 0,
          balance: order.payment_status === 'paid' ? 0 : order.total_amount,
          created_at: order.created_at,
          created_by: order.created_by
        }])
        .select()
        .single();

      if (billError) {
        console.error(`Error creating bill for order ${order.order_number}:`, billError);
        continue;
      }

      // Link order to bill
      const { error: updateError } = await supabase
        .from('restaurant_orders')
        .update({ bill_id: bill.id })
        .eq('id', order.id);

      if (updateError) {
        console.error(`Error linking order ${order.order_number} to bill:`, updateError);
        continue;
      }

      console.log(`✓ Migrated order ${order.order_number} to bill ${bill.bill_number}`);
    } catch (err) {
      console.error(`Error processing order ${order.order_number}:`, err);
    }
  }

  console.log('Migration complete!');
}

migrateOrdersToBills();
```

Run migration:

```bash
npx ts-node backend/scripts/migrate-orders-to-bills.ts
```

### Phase 4: Frontend Integration (Day 5-7)

#### Step 4.1: Create API Service

Create `frontend/src/lib/bills-api.ts`:

```typescript
import { fetchAPI } from './api';

export interface Bill {
  id: string;
  bill_number: string;
  table_number?: string;
  room_number?: string;
  guest_name?: string;
  status: 'OPEN' | 'CLOSED' | 'PAID' | 'CANCELLED';
  subtotal: number;
  vat_amount: number;
  service_charge: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  created_at: string;
}

export const billsAPI = {
  // Create new bill
  createBill: (data: {
    table_number?: string;
    room_number?: string;
    guest_name?: string;
    branch_id?: number;
  }) => fetchAPI<Bill>('/restaurant/bills', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Search open bills
  searchOpenBills: (params: {
    table_number?: string;
    room_number?: string;
    guest_name?: string;
    branch_id?: number;
  }) => fetchAPI<{ bills: Bill[] }>('/restaurant/bills/search', {
    method: 'POST',
    body: JSON.stringify(params)
  }),

  // Get bill details
  getBillDetails: (billId: string) =>
    fetchAPI<Bill>(`/restaurant/bills/${billId}`),

  // Add order to bill
  addOrderToBill: (billId: string, data: {
    items: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions?: string;
    }>;
    department?: string;
  }) => fetchAPI(`/restaurant/bills/${billId}/orders`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Record payment
  recordPayment: (billId: string, data: {
    amount: number;
    payment_method: string;
    payment_reference?: string;
    notes?: string;
  }) => fetchAPI(`/restaurant/bills/${billId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Get payment history
  getPaymentHistory: (billId: string) =>
    fetchAPI(`/restaurant/bills/${billId}/payments`),

  // Close bill
  closeBill: (billId: string) =>
    fetchAPI(`/restaurant/bills/${billId}/close`, {
      method: 'PUT'
    })
};
```

#### Step 4.2: Create Bill Search Component

Create `frontend/src/components/BillSearch.tsx`:

```typescript
import React, { useState } from 'react';
import { billsAPI, Bill } from '../lib/bills-api';

interface BillSearchProps {
  onBillSelected: (bill: Bill) => void;
}

export const BillSearch: React.FC<BillSearchProps> = ({ onBillSelected }) => {
  const [searchType, setSearchType] = useState<'table' | 'room' | 'guest'>('table');
  const [searchValue, setSearchValue] = useState('');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchType === 'table') params.table_number = searchValue;
      if (searchType === 'room') params.room_number = searchValue;
      if (searchType === 'guest') params.guest_name = searchValue;

      const response = await billsAPI.searchOpenBills(params);
      setBills(response.data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bill-search">
      <div className="search-controls">
        <select value={searchType} onChange={(e) => setSearchType(e.target.value as any)}>
          <option value="table">Table Number</option>
          <option value="room">Room Number</option>
          <option value="guest">Guest Name</option>
        </select>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={`Enter ${searchType}...`}
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="search-results">
        {bills.length === 0 && <p>No open bills found</p>}
        {bills.map((bill) => (
          <div key={bill.id} className="bill-card" onClick={() => onBillSelected(bill)}>
            <h3>{bill.bill_number}</h3>
            <p>Table: {bill.table_number || 'N/A'}</p>
            <p>Guest: {bill.guest_name || 'Walk-in'}</p>
            <p>Total: KES {bill.total_amount.toFixed(2)}</p>
            <p>Balance: KES {bill.balance.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Step 4.3: Create Add to Bill Component

Create `frontend/src/components/AddToBill.tsx`:

```typescript
import React, { useState } from 'react';
import { billsAPI, Bill } from '../lib/bills-api';
import { BillSearch } from './BillSearch';

export const AddToBill: React.FC = () => {
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const handleAddItems = async () => {
    if (!selectedBill) return;

    try {
      await billsAPI.addOrderToBill(selectedBill.id, { items });
      alert('Items added successfully!');
      setSelectedBill(null);
      setItems([]);
    } catch (error) {
      console.error('Error adding items:', error);
      alert('Failed to add items');
    }
  };

  if (!selectedBill) {
    return <BillSearch onBillSelected={setSelectedBill} />;
  }

  return (
    <div className="add-to-bill">
      <h2>Add Items to Bill {selectedBill.bill_number}</h2>
      <p>Table: {selectedBill.table_number}</p>
      <p>Current Total: KES {selectedBill.total_amount.toFixed(2)}</p>

      {/* Menu item selection UI here */}
      
      <button onClick={handleAddItems}>Add Items to Bill</button>
      <button onClick={() => setSelectedBill(null)}>Cancel</button>
    </div>
  );
};
```

### Phase 5: Testing (Day 8-9)

#### Test Scenarios

1. **Create Bill and Add Multiple Orders**
```typescript
// Test: Customer orders food, then drinks later
const bill = await billsAPI.createBill({ table_number: 'T-05', guest_name: 'John' });
await billsAPI.addOrderToBill(bill.id, { items: [/* food items */] });
// Wait 10 minutes
await billsAPI.addOrderToBill(bill.id, { items: [/* drink items */] });
// Verify: Both orders on same bill
```

2. **Partial Payments**
```typescript
// Test: Customer pays in installments
await billsAPI.recordPayment(bill.id, { amount: 500, payment_method: 'CASH' });
// Verify: Bill status = CLOSED, balance updated
await billsAPI.recordPayment(bill.id, { amount: 300, payment_method: 'MPESA' });
// Verify: Bill status = PAID when balance = 0
```

3. **Overpayment Prevention**
```typescript
// Test: Try to pay more than balance
try {
  await billsAPI.recordPayment(bill.id, { amount: 10000, payment_method: 'CASH' });
} catch (error) {
  // Verify: Error thrown, payment rejected
}
```

4. **Paid Bill Locking**
```typescript
// Test: Try to add items to paid bill
try {
  await billsAPI.addOrderToBill(paidBill.id, { items: [/* items */] });
} catch (error) {
  // Verify: Error thrown, modification rejected
}
```

5. **VAT Calculation**
```typescript
// Test: VAT calculated correctly
const bill = await billsAPI.getBillDetails(billId);
// Verify: vat_amount = subtotal * 0.16
// Verify: total_amount = subtotal + vat_amount + service_charge
```

### Phase 6: Deployment (Day 10)

#### Step 6.1: Backup Database

```bash
pg_dump -h your-host -U postgres -d your-db > backup_before_billing_system.sql
```

#### Step 6.2: Deploy Migration

```bash
# Production deployment
npm run migrate:prod
```

#### Step 6.3: Deploy Backend

```bash
# Build and deploy
npm run build
pm2 restart backend
```

#### Step 6.4: Deploy Frontend

```bash
npm run build
# Deploy to your hosting
```

## Configuration

### VAT Rate Configuration

To change VAT rate (default 16% for Kenya):

```sql
-- Update default VAT rate
ALTER TABLE restaurant_bills 
ALTER COLUMN vat_rate SET DEFAULT 14.00; -- Example: 14%

-- Update existing bills
UPDATE restaurant_bills 
SET vat_rate = 14.00 
WHERE status = 'OPEN';
```

### Service Charge Configuration

```sql
-- Enable 10% service charge
UPDATE restaurant_bills 
SET service_charge_rate = 10.00 
WHERE status = 'OPEN';
```

## Troubleshooting

### Issue: Bills not calculating correctly

```sql
-- Manually recalculate bill
SELECT calculate_bill_totals('bill-uuid-here');
```

### Issue: Payment not updating bill status

```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'update_bill_status_on_payment_trigger';

-- Manually update status
UPDATE restaurant_bills 
SET status = 'PAID', paid_at = NOW() 
WHERE balance <= 0 AND status != 'PAID';
```

### Issue: Cannot add orders to bill

```sql
-- Check bill status
SELECT id, bill_number, status FROM restaurant_bills WHERE id = 'bill-uuid';

-- If wrongly marked as PAID, reopen
UPDATE restaurant_bills SET status = 'OPEN' WHERE id = 'bill-uuid';
```

## Monitoring

### Key Metrics to Track

```sql
-- Open bills count
SELECT COUNT(*) FROM restaurant_bills WHERE status = 'OPEN';

-- Average bill value
SELECT AVG(total_amount) FROM restaurant_bills WHERE status = 'PAID';

-- Payment method distribution
SELECT payment_method, COUNT(*), SUM(amount) 
FROM restaurant_bill_payments 
WHERE reversed = false 
GROUP BY payment_method;

-- VAT collected today
SELECT SUM(vat_amount) 
FROM restaurant_bills 
WHERE DATE(paid_at) = CURRENT_DATE AND status = 'PAID';
```

## Support

For issues or questions:
1. Check logs: `tail -f backend/logs/app.log`
2. Check database: Review `restaurant_bill_audit_log` table
3. Review this guide
4. Contact development team

---

**Implementation Status**: Ready for deployment
**Estimated Time**: 10 days
**Risk Level**: Medium (requires careful testing)
