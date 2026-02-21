# Design Document: Add to Existing Bill

## Overview

This feature enables waiters to add new orders to existing customer bills in the restaurant POS system. The design integrates with the existing order management system, offline mode support, and database architecture to provide a seamless experience for consolidating multiple orders onto a single bill.

The system will allow waiters to search for open bills, select one, and add new menu items that will be tracked as a separate order within the same bill, maintaining full audit trails and proper synchronization between online and offline modes.

## Architecture

### System Components

The feature integrates with the existing architecture:

1. **Frontend (React/Next.js)**: UI for searching bills and adding items
2. **API Layer** (`frontend/src/lib/api.ts`): HTTP requests with offline fallback
3. **Backend API** (Node.js/Express): Server-side order and bill management
4. **Electron Bridge** (`electron/main.js`): Offline mode support and local database
5. **Local Database** (`electron/database.js`): SQLite for offline data persistence
6. **Supabase**: Cloud database for online synchronization

### Data Flow

**Online Mode:**
```
Waiter → Frontend UI → API Layer → Backend API → Supabase → Response
```

**Offline Mode:**
```
Waiter → Frontend UI → Electron Bridge → SQLite → Sync Queue → (Later) Backend API
```

## Components and Interfaces

### 1. Bill Search Component

**Purpose**: Allow waiters to find existing open bills

**Interface**:
```typescript
interface BillSearchProps {
  onBillSelected: (bill: Bill) => void;
  branchId: number;
}

interface Bill {
  id: string;
  order_number: string;
  table_number?: string;
  room_number?: string;
  guest_name?: string;
  total_amount: number;
  status: 'pending' | 'in_progress' | 'completed';
  payment_status: 'unpaid' | 'partial' | 'paid';
  created_at: string;
  orders: Order[];
}

interface Order {
  id: string;
  bill_id: string;
  waiter_id: string;
  waiter_name: string;
  created_at: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
}
```

**Search Methods**:
- Search by table number
- Search by room number
- Search by guest name
- Search by order/bill number
- List all open bills

### 2. Add Items Component

**Purpose**: Interface for adding new menu items to selected bill

**Interface**:
```typescript
interface AddItemsToBillProps {
  bill: Bill;
  onItemsAdded: (newOrder: Order) => void;
  onCancel: () => void;
}

interface AddItemsRequest {
  bill_id: string;
  items: {
    menu_item_id: string;
    quantity: number;
    unit_price: number;
    special_instructions?: string;
  }[];
  waiter_id: string;
  waiter_name: string;
}
```

### 3. API Service Extensions

**New API Endpoints**:

```typescript
// In frontend/src/lib/api.ts
export const restaurantAPI = {
  // ... existing methods ...
  
  // Search for open bills
  searchOpenBills: (params: {
    branch_id?: number;
    table_number?: string;
    room_number?: string;
    guest_name?: string;
    order_number?: string;
  }) => fetchAPI<{ bills: Bill[] }>('/restaurant/bills/search', {
    method: 'POST',
    body: JSON.stringify(params)
  }),
  
  // Get bill details with all orders
  getBillDetails: (billId: string) => 
    fetchAPI<Bill>(`/restaurant/bills/${billId}`),
  
  // Add items to existing bill
  addItemsToBill: async (data: AddItemsRequest) => {
    // Offline mode handling
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const isOnline = await (window as any).electronAPI.net.isOnline();
      
      if (!isOnline) {
        const orderId = `order-${Date.now()}-${Math.random()}`;
        const orderData = {
          id: orderId,
          bill_id: data.bill_id,
          waiter_id: data.waiter_id,
          waiter_name: data.waiter_name,
          created_at: new Date().toISOString(),
          status: 'pending'
        };
        
        // Save order to local database
        await (window as any).electronAPI.db.upsert('bill_orders', orderData);
        
        // Save order items
        for (const item of data.items) {
          await (window as any).electronAPI.db.upsert('bill_order_items', {
            id: `item-${Date.now()}-${Math.random()}`,
            order_id: orderId,
            ...item,
            total_price: item.quantity * item.unit_price,
            created_at: new Date().toISOString()
          });
        }
        
        // Queue for sync
        await (window as any).electronAPI.sync.queue(
          'pos:addItemsToBill',
          `/restaurant/bills/${data.bill_id}/add-items`,
          'POST',
          data,
          data.branch_id,
          localStorage.getItem('token')
        );
        
        return { success: true, order: orderData, offline: true };
      }
    }
    
    return fetchAPI<{ order: Order }>(`/restaurant/bills/${data.bill_id}/add-items`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
```

### 4. Backend API Endpoints

**New Routes** (to be implemented in backend):

```typescript
// POST /api/restaurant/bills/search
// Search for open bills based on criteria
// Returns: { bills: Bill[] }

// GET /api/restaurant/bills/:billId
// Get full bill details including all orders
// Returns: Bill

// POST /api/restaurant/bills/:billId/add-items
// Add new items to existing bill
// Body: AddItemsRequest
// Returns: { order: Order, bill: Bill }
```

### 5. Database Schema Extensions

**New Tables** (SQLite for offline, Supabase for online):

```sql
-- Bills table (consolidates multiple orders)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  bill_number TEXT UNIQUE NOT NULL,
  branch_id INTEGER NOT NULL,
  table_number TEXT,
  room_number TEXT,
  guest_id TEXT,
  guest_name TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, partial, paid
  total_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  created_by TEXT NOT NULL
);

-- Bill orders (multiple orders per bill)
CREATE TABLE IF NOT EXISTS bill_orders (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL,
  order_number TEXT,
  waiter_id TEXT NOT NULL,
  waiter_name TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Bill order items
CREATE TABLE IF NOT EXISTS bill_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  menu_item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  special_instructions TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES bill_orders(id)
);

-- Index for fast bill searches
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status, branch_id);
CREATE INDEX IF NOT EXISTS idx_bills_table ON bills(table_number, branch_id);
CREATE INDEX IF NOT EXISTS idx_bills_room ON bills(room_number, branch_id);
CREATE INDEX IF NOT EXISTS idx_bills_guest ON bills(guest_name, branch_id);
CREATE INDEX IF NOT EXISTS idx_bill_orders_bill ON bill_orders(bill_id);
```

**Migration Strategy**:
- Existing `restaurant_orders` table represents individual orders
- New `bills` table groups multiple orders together
- For backward compatibility, single-order bills will have one entry in `bill_orders`
- Migration script will create bills from existing orders

## Data Models

### Bill Model

```typescript
interface Bill {
  id: string;
  bill_number: string;
  branch_id: number;
  table_number?: string;
  room_number?: string;
  guest_id?: string;
  guest_name?: string;
  status: 'open' | 'closed' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_amount: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  created_by: string;
  orders: BillOrder[];
}

interface BillOrder {
  id: string;
  bill_id: string;
  order_number?: string;
  waiter_id: string;
  waiter_name: string;
  subtotal: number;
  created_at: string;
  items: BillOrderItem[];
}

interface BillOrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  special_instructions?: string;
  created_at: string;
}
```

### Business Rules

1. **Bill Status**:
   - `open`: Can accept new orders
   - `closed`: No new orders, awaiting payment
   - `cancelled`: Bill cancelled, no payment

2. **Payment Status**:
   - `unpaid`: No payment received
   - `partial`: Some payment received
   - `paid`: Fully paid

3. **Total Calculation**:
   - Bill total = Sum of all order subtotals
   - Order subtotal = Sum of all item total_prices
   - Item total_price = quantity × unit_price

4. **Authorization**:
   - Only authenticated waiters can add items
   - Waiters can only add to open bills
   - Cannot add to paid or closed bills

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Open Bills Search Returns Only Open Bills
*For any* search query (table, customer name, bill number, or list all), all returned bills should have status='open' and payment_status != 'paid'
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Table Number Search Accuracy
*For any* table number search query, all returned bills should have a matching table_number and status='open'
**Validates: Requirements 1.2**

### Property 3: Customer Name Search Accuracy
*For any* customer name search query, all returned bills should have a matching guest_name and status='open'
**Validates: Requirements 1.3**

### Property 4: Bill Number Search Returns Exact Match
*For any* bill number search, if a bill with that number exists and is open, it should be returned; otherwise, empty results
**Validates: Requirements 1.4**

### Property 5: Adding Items Creates New Order
*For any* set of menu items added to an open bill, a new order record should be created with a current timestamp
**Validates: Requirements 2.2**

### Property 6: Adding Items Preserves Existing Data
*For any* bill, adding new items should not modify, delete, or change any existing orders or items on that bill
**Validates: Requirements 2.3**

### Property 7: Waiter Attribution
*For any* items added to a bill, the order should record the waiter_id and waiter_name of the waiter who added them
**Validates: Requirements 2.4, 4.3**

### Property 8: Bill Total Recalculation
*For any* items added to a bill, the new bill total should equal the old total plus the sum of (quantity × unit_price) for all new items
**Validates: Requirements 2.5, 5.1**

### Property 9: Bill Total Accuracy
*For any* bill, the bill_total should equal the sum of all item total_prices across all orders on that bill
**Validates: Requirements 5.2, 5.4, 6.3**

### Property 10: Order Display Completeness
*For any* bill with multiple orders, displaying the bill should show each order with its timestamp and waiter information
**Validates: Requirements 3.1, 3.2**

### Property 11: Chronological Order Sorting
*For any* bill with multiple orders, the orders should be sorted by created_at timestamp in chronological order
**Validates: Requirements 3.3**

### Property 12: Waiter Authentication Required
*For any* add-items request, it should only succeed if the requesting user has role='waiter' or role='admin' and is authenticated
**Validates: Requirements 4.1**

### Property 13: Non-Waiter Rejection
*For any* add-items request from a non-authenticated user or non-waiter role, the request should be rejected with an authorization error
**Validates: Requirements 4.2**

### Property 14: Modification Timestamp Recording
*For any* bill modification (adding items), the bill's updated_at timestamp should be set to the current time
**Validates: Requirements 4.4**

### Property 15: All Menu Item Types Accepted
*For any* menu item (food, drink, dessert, etc.), it should be addable to any open bill regardless of category
**Validates: Requirements 6.1**

### Property 16: All Item Types Displayed
*For any* bill, displaying it should show all items from all orders regardless of their category or type
**Validates: Requirements 6.2**

### Property 17: Offline Bill Modification
*For any* cached open bill in offline mode, adding items should succeed and store the new order locally
**Validates: Requirements 7.1, 7.2**

### Property 18: Offline Sync Queue Persistence
*For any* offline modification, it should be added to the sync queue and remain there until successfully synchronized
**Validates: Requirements 7.3, 8.4**

### Property 19: Timestamp Preservation During Sync
*For any* offline order that is synchronized, the server-side created_at timestamp should match the local timestamp when the order was created
**Validates: Requirements 7.4**

### Property 20: Closed Bill Rejection
*For any* bill with status='closed' or payment_status='paid', attempts to add items should be rejected with an error
**Validates: Requirements 8.1**

## Error Handling

### Error Scenarios

1. **Bill Not Found**
   - Return 404 with message: "Bill not found"
   - Frontend displays user-friendly message

2. **Bill Closed or Paid**
   - Return 400 with message: "Cannot add items to closed or paid bill"
   - Frontend prevents action and shows error

3. **Unauthorized Access**
   - Return 401/403 with message: "Only waiters can modify bills"
   - Frontend redirects to login or shows error

4. **Network Failure (Offline)**
   - Queue operation in sync_queue table
   - Show success message with "offline" indicator
   - Auto-sync when connection restored

5. **Invalid Menu Items**
   - Return 400 with message: "Invalid menu item ID"
   - Frontend validates items before submission

6. **Database Errors**
   - Log error details
   - Return 500 with generic message
   - Preserve data in sync queue if offline

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
}
```

### Retry Logic

- Network errors: Exponential backoff (1s, 2s, 4s, 8s, max 60s)
- Max retry attempts: 10
- Failed items remain in sync queue for manual review
- Sync status visible in UI

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of bill searches
- Edge cases (empty results, single item, closed bills)
- Error conditions (unauthorized, not found, invalid data)
- Integration between components
- UI interactions and state management

**Property-Based Tests** focus on:
- Universal properties across all inputs
- Search accuracy with random data
- Total calculation correctness
- Data preservation invariants
- Authorization rules

Together, unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across all possible inputs.

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript/JavaScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: add-to-existing-bill, Property {number}: {property_text}`
- Each correctness property implemented as a SINGLE property-based test

**Example Property Test Structure**:

```typescript
import fc from 'fast-check';

// Feature: add-to-existing-bill, Property 8: Bill Total Recalculation
test('adding items recalculates bill total correctly', () => {
  fc.assert(
    fc.property(
      fc.record({
        oldTotal: fc.float({ min: 0, max: 10000 }),
        newItems: fc.array(fc.record({
          quantity: fc.integer({ min: 1, max: 10 }),
          unit_price: fc.float({ min: 0.01, max: 1000 })
        }), { minLength: 1, maxLength: 20 })
      }),
      ({ oldTotal, newItems }) => {
        const expectedTotal = oldTotal + newItems.reduce(
          (sum, item) => sum + (item.quantity * item.unit_price), 
          0
        );
        const actualTotal = calculateBillTotal(oldTotal, newItems);
        expect(actualTotal).toBeCloseTo(expectedTotal, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Coverage

**Search Functionality**:
- Search by table number returns correct bills
- Search by customer name (case-insensitive)
- Search by bill number (exact match)
- Empty search results handled gracefully
- Multiple bills for same table

**Adding Items**:
- Add single item to bill
- Add multiple items to bill
- Add items to bill with existing orders
- Verify new order created
- Verify waiter attribution
- Verify timestamp recorded

**Authorization**:
- Waiter can add items
- Admin can add items
- Non-waiter rejected
- Unauthenticated user rejected

**Offline Mode**:
- Add items while offline
- Items stored in local database
- Sync queue populated
- Sync on reconnection
- Timestamp preserved

**Error Cases**:
- Add to closed bill rejected
- Add to paid bill rejected
- Invalid menu item rejected
- Bill not found handled
- Network error handled

### Integration Tests

- End-to-end flow: search → select → add items → verify
- Offline to online transition
- Multiple waiters adding to same bill
- Bill total calculation across multiple orders
- UI state management during operations

### Test Data Generators

For property-based tests, generate:
- Random bills with varying states
- Random menu items with different prices
- Random search queries
- Random user roles and authentication states
- Random network conditions (online/offline)

## Implementation Notes

### Migration from Current System

The current system uses `restaurant_orders` as the primary entity. The new system introduces `bills` as a container for multiple orders:

**Migration Steps**:
1. Create new tables (bills, bill_orders, bill_order_items)
2. Migrate existing restaurant_orders to bills (1 order = 1 bill initially)
3. Update frontend to use new bill-based API
4. Maintain backward compatibility during transition
5. Deprecate old order-only endpoints after migration

### Backward Compatibility

During migration:
- Old `restaurant_orders` API continues to work
- New bill API available alongside
- Frontend can use either API
- Gradual migration of features to bill-based system

### Performance Considerations

- Index bills by status, table_number, room_number, guest_name
- Cache open bills list in frontend
- Lazy load bill details (orders/items) on selection
- Batch sync operations in offline mode
- Optimize total calculation queries

### Security Considerations

- Validate waiter authentication on every request
- Verify bill belongs to waiter's branch
- Sanitize search inputs to prevent SQL injection
- Rate limit search operations
- Audit log all bill modifications

### Offline Mode Considerations

- Cache open bills on app start
- Sync bills periodically when online
- Handle conflicts (bill closed while offline)
- Show offline indicator in UI
- Queue all modifications for sync
- Preserve operation order in sync queue
