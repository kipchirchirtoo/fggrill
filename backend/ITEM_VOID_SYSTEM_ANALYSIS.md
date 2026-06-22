# 📋 Item-Level Void System - Complete Analysis

**Commit:** a1e0a2624
**Date:** 2026-06-21 02:10:52
**Files Changed:** 6 files (+1,330 lines, -16 lines)

---

## 🎯 WHAT WAS BUILT

### **Problem Solved**
Previously, waiters could only void **entire bills**. If they made a mistake on just one line item (e.g., entered 5 beers instead of 3), they had to:
1. Void the entire bill
2. Re-create the bill from scratch
3. Wait for manager approval

This was wasteful and time-consuming.

### **Solution**
Now waiters can void **individual line items** with quantity control:
- Void part of an item (e.g., void 2 out of 5 beers)
- Void entire line item (e.g., void all 3 sodas)
- Requires manager/accountant approval
- Fully audited with approval workflow

---

## 🏗️ ARCHITECTURE

### **Data Model**

The challenge: POS bills use **JSONB arrays** for items, not relational tables.

```sql
pos_shift_orders.items = [
  { name: "Tusker", quantity: 5, unit_price: 200 },
  { name: "Coca Cola", quantity: 3, unit_price: 80 }
]
```

**This means:**
- No `order_items` table with individual IDs
- Items are identified by **array index** (0, 1, 2, etc.)
- Void state must be tracked **inside the JSONB item object**

---

## 📊 DATABASE SCHEMA

### **1. pos_item_void_requests** (Main tracking table)

```sql
CREATE TABLE pos_item_void_requests (
  id UUID PRIMARY KEY,

  -- Bill identification
  shift_id UUID REFERENCES pos_outlet_shifts,
  outlet_id UUID REFERENCES pos_outlets,
  order_id UUID REFERENCES pos_shift_orders,
  order_number TEXT,
  branch_id INTEGER REFERENCES branches,

  -- Item identification (no line item ID exists, so use array index)
  item_index INTEGER NOT NULL,  -- Position in pos_shift_orders.items array
  item_name TEXT,
  unit_price NUMERIC(14,2),

  -- Void request details
  qty_before_void NUMERIC(14,3),  -- Active quantity before this void
  qty_to_void NUMERIC(14,3),      -- How much to void

  -- Reason (required)
  reason TEXT NOT NULL,
  reason_category TEXT CHECK (reason_category IN (
    'wrong_order',
    'duplicate_entry',
    'customer_changed_mind',
    'pricing_error',
    'other'
  )),
  note TEXT,  -- Optional additional context

  -- Workflow
  requested_by UUID REFERENCES users,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  actioned_by UUID REFERENCES users,
  actioned_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Critical Index:**
```sql
-- Only ONE pending request per line item at a time (prevents race conditions)
CREATE UNIQUE INDEX idx_pos_item_void_requests_one_pending_per_item
  ON pos_item_void_requests(order_id, item_index)
  WHERE status = 'pending';
```

---

### **2. pos_item_void_log** (Append-only audit trail)

```sql
CREATE TABLE pos_item_void_log (
  id UUID PRIMARY KEY,
  void_request_id UUID REFERENCES pos_item_void_requests,

  -- Bill & item identification
  shift_id UUID,
  order_id UUID,
  item_index INTEGER,
  item_name TEXT,
  unit_price NUMERIC(14,2),

  -- Quantities (before/after snapshot)
  qty_before_void NUMERIC(14,3),
  qty_voided NUMERIC(14,3),
  qty_after_void NUMERIC(14,3),
  amount_voided NUMERIC(14,2),  -- Financial impact

  -- Authorization
  authorized_by UUID REFERENCES users,
  requested_by UUID REFERENCES users,
  void_reason TEXT,
  reason_category TEXT,

  -- Context
  branch_id INTEGER,
  outlet_type TEXT,
  bill_code TEXT,
  voided_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- **Immutable audit trail** - never deleted, even if request is deleted
- **Per-waiter analytics** - track void patterns by waiter
- **Financial reconciliation** - sum of `amount_voided` for shift close

---

### **3. Item JSONB Mutation**

When a void is **approved**, the item object in `pos_shift_orders.items` is mutated:

**BEFORE:**
```json
{
  "name": "Tusker",
  "quantity": 5,
  "unit_price": 200
}
```

**AFTER (voiding 2 out of 5):**
```json
{
  "name": "Tusker",
  "quantity": 5,           // Original quantity (unchanged)
  "unit_price": 200,
  "voided_qty": 2,         // NEW: How many voided
  "active_qty": 3,         // NEW: Remaining active (5 - 2)
  "is_fully_voided": false,// NEW: Boolean flag
  "active_total": 600      // NEW: 3 × 200 = 600
}
```

**AFTER (voiding all 5):**
```json
{
  "name": "Tusker",
  "quantity": 5,
  "unit_price": 200,
  "voided_qty": 5,
  "active_qty": 0,
  "is_fully_voided": true,  // ✓ Item fully voided
  "active_total": 0
}
```

---

## ⚙️ STORED PROCEDURE: `void_order_item()`

### **Purpose**
Atomically execute an approved void under row-level locks to prevent race conditions.

### **Function Signature**
```sql
public.void_order_item(
  p_request_id UUID,      -- The void request to process
  p_actioned_by UUID      -- Manager/accountant approving
) RETURNS pos_shift_orders
```

### **Step-by-Step Execution**

```sql
BEGIN
  -- 1. LOCK THE REQUEST (prevents concurrent approvals)
  SELECT * FROM pos_item_void_requests
  WHERE id = p_request_id
  FOR UPDATE;  -- Row-level lock

  -- 2. VALIDATE REQUEST STATUS
  IF status != 'pending' THEN
    RAISE EXCEPTION 'Already processed';

  -- 3. LOCK THE BILL (prevents concurrent modifications)
  SELECT * FROM pos_shift_orders
  WHERE id = request.order_id
  FOR UPDATE;  -- Row-level lock

  -- 4. EXTRACT ITEM FROM JSONB ARRAY
  v_item := order.items -> request.item_index;
  v_quantity := v_item->>'quantity';
  v_voided_qty_before := COALESCE(v_item->>'voided_qty', 0);
  v_active_qty_before := v_quantity - v_voided_qty_before;

  -- 5. VALIDATE VOID QUANTITY
  IF request.qty_to_void > v_active_qty_before THEN
    RAISE EXCEPTION 'Exceeds remaining active quantity';

  -- 6. CALCULATE NEW VALUES
  v_voided_qty_after := v_voided_qty_before + request.qty_to_void;
  v_active_qty_after := v_quantity - v_voided_qty_after;
  v_amount_voided := request.qty_to_void * v_unit_price;

  -- 7. MUTATE THE ITEM (add void tracking fields)
  v_updated_item := v_item || jsonb_build_object(
    'voided_qty', v_voided_qty_after,
    'active_qty', v_active_qty_after,
    'is_fully_voided', v_active_qty_after <= 0,
    'active_total', v_active_qty_after * v_unit_price
  );

  -- 8. UPDATE THE ITEMS ARRAY
  v_new_items := jsonb_set(
    order.items,
    ARRAY[request.item_index::TEXT],  -- Array path
    v_updated_item
  );

  -- 9. DEDUCT FROM BILL TOTALS
  v_new_total := order.total_amount - v_amount_voided;
  v_new_balance := order.balance_amount - v_amount_voided;

  -- 10. UPDATE THE BILL
  UPDATE pos_shift_orders SET
    items = v_new_items,
    total_amount = v_new_total,
    balance_amount = v_new_balance,
    updated_at = NOW()
  WHERE id = order.id;

  -- 11. WRITE AUDIT LOG (immutable)
  INSERT INTO pos_item_void_log (...);

  -- 12. MARK REQUEST AS APPROVED
  UPDATE pos_item_void_requests SET
    status = 'approved',
    actioned_by = p_actioned_by,
    actioned_at = NOW()
  WHERE id = p_request_id;

  RETURN updated_order;
END;
```

### **Why Atomic?**
- **Row locks** prevent two managers from approving the same request simultaneously
- **All-or-nothing** - if any step fails, entire transaction rolls back
- **Consistent state** - bill totals always match item totals

---

## 🔌 API ENDPOINTS

### **1. Request Item Void (Waiter)**
```http
POST /api/outlet-pos/voids/request
Authorization: Bearer <waiter_token>

{
  "shift_id": "uuid",
  "order_id": "uuid",
  "item_index": 1,            // Position in items array
  "qty_to_void": 2,           // Void 2 out of 5
  "reason": "Customer changed mind",
  "reason_category": "customer_changed_mind",
  "note": "Customer wanted wine instead"
}

Response 201:
{
  "success": true,
  "data": { ...void_request... }
}
```

**Validations:**
- ✅ Waiter owns the bill
- ✅ Item exists at that index
- ✅ `qty_to_void` ≤ active quantity
- ✅ No pending request already exists for this item
- ✅ Bill is not already paid/voided/closed

---

### **2. Approve Void (Manager/Accountant)**
```http
PATCH /api/outlet-pos/voids/:id/approve
Authorization: Bearer <manager_token>

Response 200:
{
  "success": true,
  "data": { ...updated_order... }
}
```

**What Happens:**
1. Calls `void_order_item()` stored procedure
2. Mutates item JSONB
3. Deducts from bill total/balance
4. Writes audit log
5. Marks request approved
6. Returns updated bill

**Race Condition Handling:**
- If two managers approve simultaneously:
  - First approval succeeds
  - Second gets error: "Void request already processed"

---

### **3. Reject Void (Manager/Accountant)**
```http
PATCH /api/outlet-pos/voids/:id/reject
Authorization: Bearer <manager_token>

{
  "rejection_reason": "Item was actually correct"
}

Response 200:
{
  "success": true,
  "data": { ...updated_request... }
}
```

**What Happens:**
1. Marks request as rejected
2. Sends notification to waiter
3. Bill remains unchanged

---

### **4. Get Pending Voids for Shift**
```http
GET /api/outlet-pos/shifts/:shiftId/pending-voids
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "item_name": "Tusker",
      "qty_to_void": 2,
      "reason": "Customer changed mind",
      "requested_by_name": "Jane Doe",
      "created_at": "2026-06-21T10:30:00Z",
      "status": "pending"
    }
  ],
  "count": 1
}
```

**Used For:**
- Manager approval UI
- Shift close validation (blocks if count > 0)

---

### **5. Get Void History for Waiter**
```http
GET /api/outlet-pos/voids/waiter/:waiterId?from=2026-06-01&to=2026-06-30
Authorization: Bearer <accountant_token>

Response 200:
{
  "success": true,
  "data": [
    {
      "item_name": "Tusker",
      "qty_to_void": 2,
      "reason": "wrong_order",
      "status": "approved",
      "actioned_by_name": "John Manager",
      "created_at": "..."
    }
  ]
}
```

**Used For:**
- Waiter performance analytics
- Pattern detection (is waiter voiding too much?)
- Audit investigations

---

## 🔒 SHIFT CLOSE INTEGRATION

### **Backend Changes (cashier.controller.ts)**

**BEFORE:**
```typescript
export const closeShift = async (req, res, next) => {
  // ... close shift logic
};
```

**AFTER:**
```typescript
export const closeShift = async (req, res, next) => {
  // NEW: Check for pending item voids
  const { data: pendingVoids } = await supabase
    .from('pos_item_void_requests')
    .select('id')
    .eq('branch_id', shift.branch_id)
    .eq('status', 'pending');

  if (pendingVoids && pendingVoids.length > 0) {
    throw new AppError(
      `Cannot close shift while ${pendingVoids.length} pending item void request(s) exist. ` +
      `Escalate to branch accountant to approve or reject.`,
      400
    );
  }

  // ... continue with shift close
};
```

**Impact:**
- ✅ Prevents shift close with pending voids
- ✅ Forces accountability (manager must review)
- ✅ Ensures all financial changes are approved

---

## 📱 FLUTTER UI CHANGES

### **outlet_pos_screen.dart** (+536 lines)

**Bill Detail Sheet Enhancements:**

1. **Void Button per Line Item**
   ```dart
   // Each item now has a void button
   IconButton(
     icon: Icon(Icons.delete_outline),
     onPressed: () => _showVoidItemDialog(item, index),
   )
   ```

2. **Void Item Dialog**
   ```dart
   void _showVoidItemDialog(item, index) {
     showDialog(
       child: VoidItemDialog(
         itemName: item.name,
         availableQty: item.active_qty ?? item.quantity,
         onSubmit: (qty, reason, category, note) async {
           await repository.requestItemVoid(
             shiftId, orderId, index, qty, reason, category, note
           );
         }
       )
     );
   }
   ```

3. **Real-time Status Updates**
   ```dart
   // Poll for void request updates every 3 seconds
   Timer.periodic(Duration(seconds: 3), (_) async {
     final voids = await repository.getPendingVoidsForShift(shiftId);
     setState(() => _pendingVoids = voids);
   });

   // Show status badge on items with pending voids
   if (item.has_pending_void) {
     Chip(label: Text('VOID PENDING'), color: Colors.orange);
   }
   ```

4. **Manager Approval UI** (Role-gated)
   ```dart
   if (userRole == 'manager' || userRole == 'accountant') {
     ListView(
       children: pendingVoids.map((void) => Card(
         title: Text('${void.item_name} (${void.qty_to_void})'),
         subtitle: Text(void.reason),
         actions: [
           TextButton('Approve', onPressed: () => approveVoid(void.id)),
           TextButton('Reject', onPressed: () => rejectVoid(void.id)),
         ]
       ))
     );
   }
   ```

---

## 🔐 SECURITY & AUTHORIZATION

### **Who Can Do What?**

| Action | Waiter | Manager | Accountant | Admin |
|--------|--------|---------|------------|-------|
| Request void | ✓ (own bills only) | ✓ | ✓ | ✓ |
| Approve void | ✗ | ✓ | ✓ | ✓ |
| Reject void | ✗ | ✓ | ✓ | ✓ |
| View void history | ✗ | ✓ | ✓ | ✓ |

### **Access Controls**

```typescript
// Waiter can only void their own bills
const ensureOrderOwnerAccess = (req, order) => {
  if (order.waiter_id !== req.user.id && !isReviewRole(req)) {
    throw new AppError('Forbidden: not your bill', 403);
  }
};

// Only managers/accountants can approve
const REVIEW_ROLES = new Set([
  'manager', 'restaurant_manager', 'branch_manager',
  'accountant', 'branch_accountant', 'super_admin'
]);

if (!REVIEW_ROLES.has(req.user.role)) {
  throw new AppError('Forbidden: manager approval required', 403);
}
```

---

## 💡 EXAMPLE SCENARIOS

### **Scenario 1: Partial Void**

**Initial Bill:**
```
Tusker Lager × 5 @ KES 200 = KES 1,000
Coca Cola × 3 @ KES 80 = KES 240
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: KES 1,240
```

**Waiter realizes customer only wanted 3 Tuskers:**

1. **Waiter requests void:**
   ```json
   {
     "item_index": 0,
     "qty_to_void": 2,
     "reason": "Customer changed mind"
   }
   ```

2. **Manager sees pending request:**
   ```
   📋 Pending Void Request
   Item: Tusker Lager
   Requested by: Jane (Waiter)
   Void: 2 out of 5
   Reason: Customer changed mind
   [Approve] [Reject]
   ```

3. **Manager approves:**
   - Stored procedure executes
   - Item mutated:
     ```json
     {
       "name": "Tusker Lager",
       "quantity": 5,
       "voided_qty": 2,
       "active_qty": 3,
       "active_total": 600
     }
     ```
   - Bill total: KES 1,240 - KES 400 = **KES 840**

**Final Bill:**
```
Tusker Lager × 3 @ KES 200 = KES 600  (was 5, voided 2)
Coca Cola × 3 @ KES 80 = KES 240
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: KES 840
```

---

### **Scenario 2: Full Item Void**

**Initial Bill:**
```
Whiskey × 1 @ KES 1,500 = KES 1,500
Tusker × 2 @ KES 200 = KES 400
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: KES 1,900
```

**Waiter accidentally added whiskey (wrong order):**

1. **Void entire item:**
   ```json
   {
     "item_index": 0,
     "qty_to_void": 1,
     "reason_category": "wrong_order"
   }
   ```

2. **Manager approves**

3. **Item becomes:**
   ```json
   {
     "name": "Whiskey",
     "quantity": 1,
     "voided_qty": 1,
     "active_qty": 0,
     "is_fully_voided": true,
     "active_total": 0
   }
   ```

**Final Bill:**
```
Whiskey × 0 @ KES 1,500 = KES 0  (VOIDED)
Tusker × 2 @ KES 200 = KES 400
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: KES 400
```

---

## 📊 AUDIT TRAIL EXAMPLE

**Query void history:**
```sql
SELECT
  v.item_name,
  v.qty_voided,
  v.amount_voided,
  v.void_reason,
  u1.first_name || ' ' || u1.last_name AS requested_by,
  u2.first_name || ' ' || u2.last_name AS authorized_by,
  v.voided_at
FROM pos_item_void_log v
LEFT JOIN users u1 ON v.requested_by = u1.id
LEFT JOIN users u2 ON v.authorized_by = u2.id
WHERE v.branch_id = 2
  AND v.voided_at >= '2026-06-01'
ORDER BY v.voided_at DESC;
```

**Result:**
| Item | Qty | Amount | Reason | Requested By | Approved By | Date |
|------|-----|--------|--------|--------------|-------------|------|
| Tusker | 2 | 400.00 | Customer changed mind | Jane Doe | John Manager | 2026-06-21 14:30 |
| Whiskey | 1 | 1500.00 | Wrong order | Jane Doe | John Manager | 2026-06-21 11:15 |
| Coca Cola | 1 | 80.00 | Duplicate entry | Mary Smith | Alice Accountant | 2026-06-20 16:45 |

---

## 🎯 KEY BENEFITS

✅ **Efficiency** - No need to void entire bills for small mistakes
✅ **Accountability** - Every void requires manager approval
✅ **Auditability** - Immutable log of all voids with reasons
✅ **Real-time** - Supabase Realtime for live status updates
✅ **Race-proof** - Atomic stored procedure prevents double-approval
✅ **Flexible** - Partial or full voids supported
✅ **Financial integrity** - Bill totals always consistent with item totals
✅ **Shift close safety** - Blocks close until all voids reviewed

---

## ⚠️ IMPORTANT NOTES

1. **JSONB Limitation:**
   - Items don't have individual IDs
   - Identified by array index (fragile if items reordered)
   - Future improvement: add `item_id` to each JSONB item

2. **Realtime Subscription:**
   ```sql
   ALTER PUBLICATION supabase_realtime
   ADD TABLE pos_item_void_requests;
   ```
   - Flutter clients can subscribe to live updates
   - No polling needed (except as fallback)

3. **Reason Categories:**
   - `wrong_order` - Waiter entered wrong item
   - `duplicate_entry` - Item added twice by mistake
   - `customer_changed_mind` - Customer no longer wants it
   - `pricing_error` - Price was wrong
   - `other` - Free-text reason required

4. **Expired Status:**
   - Not currently used
   - Could be added: auto-reject voids older than 24 hours

---

## 🔄 WORKFLOW DIAGRAM

```
┌─────────────┐
│   Waiter    │
│ Creates Bill│
└──────┬──────┘
       │
       │ Realizes mistake on 1 item
       │
       ▼
┌─────────────────────┐
│ Request Item Void   │
│ - Select item       │
│ - Enter qty to void │
│ - Enter reason      │
└──────┬──────────────┘
       │
       │ INSERT INTO pos_item_void_requests
       │ status = 'pending'
       ▼
┌──────────────────────┐
│ Manager Sees Request │
│ in Approval Queue    │
└──────┬───────┬───────┘
       │       │
   APPROVE   REJECT
       │       │
       │       └──────────────┐
       │                      ▼
       │              UPDATE status='rejected'
       │              Send notification to waiter
       │              Bill unchanged
       │
       ▼
  CALL void_order_item()
  ├── Lock request row
  ├── Lock order row
  ├── Validate quantities
  ├── Mutate item JSONB
  ├── Deduct from totals
  ├── Write audit log
  └── Mark approved
       │
       ▼
┌──────────────────┐
│  Bill Updated    │
│  Totals Reduced  │
│  Waiter Notified │
└──────────────────┘
```

---

## 🏁 CONCLUSION

This is a **production-grade item void system** with:
- ✅ Atomic database operations
- ✅ Race condition prevention
- ✅ Complete audit trail
- ✅ Real-time UI updates
- ✅ Role-based authorization
- ✅ Shift close integration
- ✅ Financial integrity guarantees

The system handles the complexity of **JSONB-based bill items** while maintaining relational integrity through careful use of stored procedures, row locks, and unique indexes.
