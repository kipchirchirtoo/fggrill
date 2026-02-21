# Billing System Business Rules

## Quick Reference Guide

### Bill Status Lifecycle

```
┌─────────┐
│  OPEN   │ ← Bill created, can add orders
└────┬────┘
     │ First payment received
     ↓
┌─────────┐
│ CLOSED  │ ← No more orders, can still pay
└────┬────┘
     │ Balance reaches zero
     ↓
┌─────────┐
│  PAID   │ ← Fully paid, locked
└─────────┘

     OR
     
┌───────────┐
│ CANCELLED │ ← Voided, locked
└───────────┘
```

## Core Business Rules

### 1. Bill Creation

**Rule**: A bill must have either a table number OR room number, not both.

```typescript
// ✅ Valid
{ table_number: "T-05" }
{ room_number: "R-201" }
{ } // Walk-in, no table/room

// ❌ Invalid
{ table_number: "T-05", room_number: "R-201" } // Cannot have both
```

**Rule**: VAT rate defaults to 16% (Kenya standard rate).

**Rule**: Bill number is auto-generated in format: `BILLYYMMDDNNNN`
- Example: `BILL2602180001` = Bill created on Feb 18, 2026, sequence 0001

### 2. Adding Orders to Bills

**Rule**: Can only add orders to OPEN bills.

```typescript
// ✅ Allowed
if (bill.status === 'OPEN') {
  addOrderToBill(billId, items);
}

// ❌ Not Allowed
if (bill.status === 'CLOSED') {
  // Error: "Cannot add orders to closed bills"
}
if (bill.status === 'PAID') {
  // Error: "Cannot add orders to paid bills"
}
if (bill.status === 'CANCELLED') {
  // Error: "Cannot add orders to cancelled bills"
}
```

**Rule**: Multiple orders can be added to the same bill over time.

**Rule**: Each order tracks:
- Which waiter added it
- Timestamp when added
- Department (restaurant, bar, pool_bar, spa)

### 3. Bill Closure

**Rule**: Bills can be manually closed to prevent more orders.

```typescript
// Waiter closes bill when customer is done ordering
closeBill(billId);
// Status: OPEN → CLOSED
```

**Rule**: Bills auto-close on first payment.

```typescript
// First payment automatically closes the bill
recordPayment(billId, { amount: 500, method: 'CASH' });
// Status: OPEN → CLOSED (if was OPEN)
```

### 4. Payment Processing

**Rule**: Payments can only be made on OPEN or CLOSED bills.

```typescript
// ✅ Allowed
if (bill.status === 'OPEN' || bill.status === 'CLOSED') {
  recordPayment(billId, paymentData);
}

// ❌ Not Allowed
if (bill.status === 'PAID') {
  // Error: "Bill already fully paid"
}
if (bill.status === 'CANCELLED') {
  // Error: "Cannot accept payments for cancelled bills"
}
```

**Rule**: Multiple partial payments are allowed.

```typescript
// Example: Bill total = KES 1,000
recordPayment(billId, { amount: 300, method: 'CASH' });    // Balance: 700
recordPayment(billId, { amount: 200, method: 'MPESA' });   // Balance: 500
recordPayment(billId, { amount: 500, method: 'CARD' });    // Balance: 0, Status: PAID
```

**Rule**: Overpayments are prevented.

```typescript
// Bill balance: KES 500
recordPayment(billId, { amount: 600, method: 'CASH' });
// ❌ Error: "Payment amount (600) exceeds bill balance (500)"
```

**Rule**: Bill automatically becomes PAID when balance reaches zero.

```typescript
// Before payment
bill.total_amount = 1000;
bill.paid_amount = 700;
bill.balance = 300;
bill.status = 'CLOSED';

// After final payment
recordPayment(billId, { amount: 300, method: 'MPESA' });

// After payment
bill.paid_amount = 1000;
bill.balance = 0;
bill.status = 'PAID'; // ← Automatically updated
bill.paid_at = NOW(); // ← Timestamp recorded
```

### 5. Payment Reversals

**Rule**: Only managers can reverse payments.

**Rule**: Reversals require a reason.

```typescript
// ✅ Valid reversal
reversePayment(billId, paymentId, {
  reversal_reason: "Customer dispute - incorrect amount charged"
});

// ❌ Invalid reversal
reversePayment(billId, paymentId, {});
// Error: "Reversal reason is required"
```

**Rule**: Reversed payments don't count toward bill balance.

```typescript
// Before reversal
bill.paid_amount = 1000;
bill.balance = 0;
bill.status = 'PAID';

// After reversing 300 payment
bill.paid_amount = 700;
bill.balance = 300;
bill.status = 'CLOSED'; // ← Reverts to CLOSED
```

**Rule**: Payments cannot be reversed twice.

```typescript
reversePayment(billId, paymentId, { reason: "Error" });
// ✅ First reversal succeeds

reversePayment(billId, paymentId, { reason: "Error" });
// ❌ Error: "Payment already reversed"
```

### 6. Bill Locking

**Rule**: PAID bills are completely locked.

```typescript
if (bill.status === 'PAID') {
  // ❌ Cannot add orders
  // ❌ Cannot modify items
  // ❌ Cannot add payments (except reversals)
  // ❌ Cannot change amounts
  // ✅ Can only view and print
}
```

**Rule**: CANCELLED bills are completely locked.

```typescript
if (bill.status === 'CANCELLED') {
  // ❌ Cannot add orders
  // ❌ Cannot add payments
  // ❌ Cannot modify anything
  // ✅ Can only view for audit purposes
}
```

### 7. VAT Calculation

**Rule**: VAT is calculated on subtotal + service charge.

```typescript
subtotal = 1000;              // Sum of all items
service_charge = 100;         // 10% of subtotal
vat_base = 1100;              // subtotal + service_charge
vat_amount = 176;             // 16% of vat_base
total_amount = 1276;          // subtotal + service_charge + vat_amount
```

**Rule**: VAT rate can be configured per bill.

```typescript
// Default: 16% (Kenya standard)
{ vat_rate: 16.00 }

// Custom rate (e.g., for exempt items)
{ vat_rate: 0.00 }
```

**Rule**: VAT is recalculated whenever orders are added.

```typescript
// Initial bill
subtotal = 500;
vat_amount = 80;  // 16% of 500
total = 580;

// After adding more items
subtotal = 800;   // ← Updated
vat_amount = 128; // ← Recalculated (16% of 800)
total = 928;      // ← Updated
```

### 8. Service Charge

**Rule**: Service charge is optional and configurable.

```typescript
// No service charge
{ service_charge_rate: 0 }

// 10% service charge
{ service_charge_rate: 10.00 }
```

**Rule**: Service charge is calculated on subtotal only.

```typescript
subtotal = 1000;
service_charge = 100;  // 10% of subtotal
vat_amount = 176;      // 16% of (subtotal + service_charge)
total = 1276;
```

### 9. Split Bills

**Rule**: Only OPEN or CLOSED bills can be split.

```typescript
// ✅ Can split
if (bill.status === 'OPEN' || bill.status === 'CLOSED') {
  splitBill(billId, splitData);
}

// ❌ Cannot split
if (bill.status === 'PAID') {
  // Error: "Cannot split paid bills"
}
```

**Rule**: Split creates child bills, parent is cancelled.

```typescript
// Before split
parentBill.status = 'OPEN';
parentBill.total_amount = 1000;

// After split
parentBill.status = 'CANCELLED';
parentBill.is_split = true;

childBill1.parent_bill_id = parentBill.id;
childBill1.total_amount = 600;
childBill1.status = 'CLOSED';

childBill2.parent_bill_id = parentBill.id;
childBill2.total_amount = 400;
childBill2.status = 'CLOSED';
```

**Rule**: Child bills inherit VAT rate from parent.

### 10. Multi-Department Support

**Rule**: Orders from different departments can be on same bill.

```typescript
// Bill contains orders from multiple departments
bill.orders = [
  { department: 'restaurant', total: 500 },  // Food
  { department: 'bar', total: 300 },         // Drinks
  { department: 'pool_bar', total: 200 },    // Pool drinks
  { department: 'spa', total: 400 }          // Spa services
];
bill.total_amount = 1400;
```

**Rule**: Department is tracked for revenue reporting.

```sql
-- Revenue by department
SELECT department, SUM(total_amount) 
FROM restaurant_orders 
WHERE bill_id IN (SELECT id FROM restaurant_bills WHERE status = 'PAID')
GROUP BY department;
```

### 11. Audit Trail

**Rule**: All bill modifications are logged.

```typescript
// Logged actions:
- 'created'        // Bill created
- 'order_added'    // Order added to bill
- 'payment_received' // Payment recorded
- 'closed'         // Bill closed
- 'split'          // Bill split
- 'cancelled'      // Bill cancelled
- 'updated'        // Any other modification
```

**Rule**: Audit log includes before/after state.

```typescript
{
  action: 'payment_received',
  old_status: 'CLOSED',
  new_status: 'PAID',
  old_balance: 300,
  new_balance: 0,
  performed_by: 'user-uuid',
  performed_at: '2026-02-18T10:30:00Z'
}
```

### 12. Authorization

**Rule**: Role-based access control.

```typescript
// Create bills
Roles: Waiter, Receptionist, Manager

// Add orders
Roles: Waiter, Receptionist, Manager

// Close bills
Roles: Waiter, Cashier, Manager

// Record payments
Roles: Cashier, Manager

// Reverse payments
Roles: Manager ONLY

// View audit logs
Roles: Manager, Auditor, Branch Accountant
```

## Common Scenarios

### Scenario 1: Customer Orders Food, Then Drinks

```typescript
// 1. Create bill when customer sits down
const bill = await createBill({ table_number: 'T-05', guest_name: 'John' });
// Status: OPEN

// 2. Customer orders food
await addOrderToBill(bill.id, {
  items: [
    { menu_item_id: 'food-1', quantity: 2, unit_price: 500 }
  ],
  department: 'restaurant'
});
// Bill total: KES 1,160 (1000 + 16% VAT)

// 3. 30 minutes later, customer orders drinks
await addOrderToBill(bill.id, {
  items: [
    { menu_item_id: 'drink-1', quantity: 3, unit_price: 200 }
  ],
  department: 'bar'
});
// Bill total: KES 1,856 (1600 + 16% VAT)

// 4. Customer ready to pay
await closeBill(bill.id);
// Status: CLOSED

// 5. Customer pays
await recordPayment(bill.id, { amount: 1856, method: 'MPESA' });
// Status: PAID
```

### Scenario 2: Partial Payments

```typescript
// Bill total: KES 2,000

// Customer pays deposit
await recordPayment(bill.id, { amount: 500, method: 'CASH' });
// Status: OPEN → CLOSED (auto-closed on first payment)
// Balance: 1,500

// Customer pays more later
await recordPayment(bill.id, { amount: 1000, method: 'CARD' });
// Balance: 500

// Customer pays remaining
await recordPayment(bill.id, { amount: 500, method: 'MPESA' });
// Status: PAID
// Balance: 0
```

### Scenario 3: Split Bill by Items

```typescript
// Original bill: KES 2,000 (4 people)

// Split into 2 bills
await splitBillByItems(bill.id, {
  splits: [
    {
      guest_name: 'John & Jane',
      item_ids: ['item-1', 'item-2'] // Their items
    },
    {
      guest_name: 'Bob & Alice',
      item_ids: ['item-3', 'item-4'] // Their items
    }
  ]
});

// Result:
// Parent bill: CANCELLED
// Child bill 1: KES 1,200 (John & Jane's items)
// Child bill 2: KES 800 (Bob & Alice's items)
```

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Cannot add orders to paid bills" | Bill is locked | Create new bill |
| "Cannot add orders to closed bills" | Bill closed for orders | Reopen or create new |
| "Payment amount exceeds bill balance" | Overpayment attempt | Check balance first |
| "Bill not found" | Invalid bill ID | Verify bill exists |
| "Cannot split paid bills" | Bill already paid | Split before payment |
| "Reversal reason is required" | Missing reason | Provide reason |
| "Payment already reversed" | Duplicate reversal | Check payment status |

## Best Practices

1. **Always check bill status before operations**
   ```typescript
   const bill = await getBillDetails(billId);
   if (bill.status === 'OPEN') {
     // Safe to add orders
   }
   ```

2. **Verify balance before accepting payment**
   ```typescript
   if (paymentAmount > bill.balance) {
     throw new Error('Payment exceeds balance');
   }
   ```

3. **Log all modifications**
   ```typescript
   // Audit log is automatic, but add notes
   await recordPayment(billId, {
     amount: 500,
     method: 'CASH',
     notes: 'Customer paid with 1000 note, change given: 500'
   });
   ```

4. **Use transactions for critical operations**
   ```typescript
   // Split bill should be atomic
   await supabase.rpc('split_bill_transaction', { bill_id, splits });
   ```

5. **Always provide payment references**
   ```typescript
   await recordPayment(billId, {
     amount: 1000,
     method: 'MPESA',
     payment_reference: 'QAB7C8D9E0' // M-Pesa code
   });
   ```

---

**Document Version**: 1.0
**Last Updated**: February 18, 2026
**Status**: Production Ready
