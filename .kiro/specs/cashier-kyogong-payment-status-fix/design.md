# Cashier Kyogong Payment Status Fix Design

## Overview

This design addresses a race condition bug where Kyogong bills (shift_transactions) remain visible in the "Unpaid Bills & Reservations" section after successful payment processing. The backend correctly updates the database by changing `payment_method` from 'BILL' to 'CASH'/'MPESA'/'CARD', but the frontend's immediate query for unpaid bills returns stale data before the database update propagates. The fix implements a retry mechanism with verification, optimistic UI updates, and proper error handling to ensure the UI accurately reflects payment status.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a Kyogong bill payment completes successfully but the bill remains visible in the unpaid list due to race condition
- **Property (P)**: The desired behavior - bills should disappear from unpaid list immediately after successful payment
- **Preservation**: Existing payment processing for non-Kyogong bills (restaurant, bar, hotel, invoices) must remain unchanged
- **shift_transactions**: Database table storing Kyogong POS transactions with `payment_method` field ('BILL' for unpaid, 'CASH'/'MPESA'/'CARD' for paid)
- **payment_method**: The discriminator field used to filter unpaid bills - 'BILL' means unpaid, any other value means paid
- **Race Condition**: The timing issue where frontend queries database before the payment update has propagated
- **Optimistic Update**: Immediately updating UI state before server confirmation to improve perceived responsiveness

## Bug Details

### Fault Condition

The bug manifests when a cashier successfully processes a payment for a Kyogong bill (transaction_number matching pattern `/^[A-Z]+-\d{8}-\d{4}$/`), the backend updates the `shift_transactions.payment_method` from 'BILL' to the actual payment method, but the frontend's immediate call to `fetchUnpaidBills()` returns stale data showing the bill still has `payment_method = 'BILL'`, causing it to remain in the unpaid list.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PaymentCompletionEvent
  OUTPUT: boolean
  
  RETURN input.billType == 'kyogong'
         AND input.paymentStatus == 'completed'
         AND input.backendUpdateSuccessful == true
         AND billStillAppearsInUnpaidList(input.billNumber) == true
         AND timeSincePayment < 5000ms
END FUNCTION
```

### Examples

- **Example 1**: Cashier processes CASH payment for bill "SPA-20260220-5067" (KES 500). Backend updates `payment_method` to 'CASH'. Frontend calls `fetchUnpaidBills()` 100ms later. Database replication lag causes query to return old data with `payment_method = 'BILL'`. Bill remains visible with "Payment Pending" status.

- **Example 2**: Cashier processes MPESA payment for bill "BAR-20260220-1234" (KES 1200). Backend successfully updates database. Frontend immediately refreshes unpaid bills. Supabase read replica hasn't received the update yet. Bill appears in unpaid list despite being paid.

- **Example 3**: Cashier processes CARD payment for bill "RES-20260220-9876" (KES 800). Backend confirms payment. Frontend calls `fetchUnpaidBills()` which hits a cached query result. Bill shows as unpaid for 2-3 seconds until cache expires.

- **Edge Case**: Multiple cashiers processing payments simultaneously. Cashier A pays bill X, Cashier B's screen still shows bill X as unpaid for several seconds due to eventual consistency.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-Kyogong bill payment processing (restaurant, bar, hotel, invoices) must continue to work exactly as before
- Backend payment processing logic must remain unchanged - it correctly updates the database
- Backend unpaid bills query logic (`.eq('payment_method', 'BILL')`) must remain unchanged - it correctly filters unpaid bills
- Manual refresh of unpaid bills list must continue to work
- Concurrent payment processing by multiple cashiers must continue to work without data corruption
- Payment receipt generation and display must continue to work
- Transaction history recording must continue to work

**Scope:**
All inputs that do NOT involve Kyogong bill payments should be completely unaffected by this fix. This includes:
- Restaurant bill payments
- Bar bill payments  
- Hotel reservation payments
- Invoice payments
- Manual unpaid bill payments
- POS cart transactions (non-bill payments)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **Database Replication Lag**: Supabase uses read replicas for query performance. When the backend updates `shift_transactions.payment_method`, the write goes to the primary database. The frontend's immediate query may hit a read replica that hasn't received the update yet (eventual consistency).

2. **No Verification Logic**: The frontend calls `fetchUnpaidBills()` immediately after receiving payment success response, but doesn't verify that the specific bill has actually been removed from the unpaid list. It blindly trusts that the refresh will show updated data.

3. **Missing Retry Mechanism**: There's no retry logic to handle the race condition. The frontend makes a single query and displays whatever data it receives, even if stale.

4. **No Optimistic UI Update**: The frontend doesn't optimistically remove the paid bill from the UI state while waiting for server confirmation, leading to confusing UX where the bill appears unpaid despite successful payment.

## Correctness Properties

Property 1: Fault Condition - Kyogong Bill Removal After Payment

_For any_ Kyogong bill payment where the backend successfully processes the payment and updates `payment_method` from 'BILL' to 'CASH'/'MPESA'/'CARD', the frontend SHALL verify the bill no longer appears in the unpaid bills list within 5 seconds, using retry logic with exponential backoff to handle database replication lag.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Non-Kyogong Payment Behavior

_For any_ bill payment that is NOT a Kyogong bill (restaurant, bar, hotel, invoice, manual unpaid bill), the payment processing flow SHALL produce exactly the same behavior as the original code, preserving all existing functionality including payment recording, status updates, receipt generation, and UI refresh logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

The fix will be implemented entirely in the frontend to avoid modifying the working backend logic.

**File**: `frontend/src/app/dashboard/cashier/page.tsx`

**Function**: `handlePayment` (lines ~310-400)

**Specific Changes**:

1. **Add Verification Helper Function**:
   - Create `verifyBillRemoved(billNumber: string, maxAttempts: number): Promise<boolean>`
   - Implements retry logic with exponential backoff (100ms, 200ms, 400ms, 800ms, 1600ms)
   - Calls `fetchUnpaidBills()` and checks if bill is still in the list
   - Returns true if bill is removed, false if still present after max attempts

2. **Add Optimistic UI Update**:
   - Immediately after payment success response, optimistically remove the bill from `unpaidBills` state
   - Set a temporary "verifying..." status indicator
   - If verification fails, restore the bill to the list with error indicator

3. **Modify Payment Success Handler**:
   - After receiving payment success response, call `verifyBillRemoved()` for Kyogong bills
   - Only clear `billData` and show success message after verification succeeds
   - If verification fails after retries, show warning message but keep payment recorded

4. **Add Error Recovery**:
   - If verification fails, provide "Refresh" button to manually trigger unpaid bills refresh
   - Log verification failures for debugging
   - Show clear user feedback about verification status

5. **Add Telemetry**:
   - Track how many retries were needed for successful verification
   - Log cases where verification fails after max attempts
   - This data helps tune retry parameters and identify persistent issues

### Pseudocode

```typescript
// New helper function
async function verifyBillRemoved(
  billNumber: string, 
  maxAttempts: number = 5
): Promise<{ removed: boolean; attempts: number }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
    const delay = 100 * Math.pow(2, attempt - 1);
    await sleep(delay);
    
    // Fetch fresh unpaid bills data
    const response = await fetchAPI('/cashier/unpaid-bills');
    if (response.success) {
      const stillUnpaid = response.data.some(
        (bill: any) => bill.bill_number === billNumber
      );
      
      if (!stillUnpaid) {
        return { removed: true, attempts: attempt };
      }
    }
  }
  
  return { removed: false, attempts: maxAttempts };
}

// Modified handlePayment function
async function handlePayment() {
  // ... existing validation logic ...
  
  setIsProcessing(true);
  try {
    const identifier = getBillIdentifier(billData);
    const isKyogongBill = /^[A-Z]+-\d{8}-\d{4}$/.test(identifier);
    
    // Make payment API call
    const response = await fetchAPI('/cashier/pay', {
      method: 'POST',
      body: JSON.stringify({ bookingId: identifier, amount, method, reference })
    });
    
    if (response.success && response.data.status === 'completed') {
      // Optimistic update: immediately remove from unpaid list
      if (isKyogongBill) {
        setUnpaidBills(prev => 
          prev.filter(bill => bill.bill_number !== identifier)
        );
      }
      
      // Show initial success message
      toast.success('Payment processed successfully');
      
      // For Kyogong bills, verify removal with retry logic
      if (isKyogongBill) {
        const verification = await verifyBillRemoved(identifier, 5);
        
        if (verification.removed) {
          toast.success(`Payment verified (${verification.attempts} attempts)`);
          // Clear bill from view
          setBillData(null);
          setScanInput('');
          setPaymentAmount('');
          // ... clear other fields ...
        } else {
          // Verification failed - restore bill to list with warning
          toast.warning(
            'Payment recorded but bill still showing. Please refresh manually.',
            { duration: 5000 }
          );
          await fetchUnpaidBills(); // Final refresh attempt
        }
      } else {
        // Non-Kyogong bills: use existing logic
        await fetchUnpaidBills();
        const refresh = await fetchAPI(`/cashier/bill/${identifier}`);
        // ... existing refresh logic ...
      }
      
      // ... existing receipt and history logic ...
    }
  } catch (error) {
    toast.error(error.message || 'Payment failed');
  } finally {
    setIsProcessing(false);
  }
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by simulating race conditions, then verify the fix works correctly with retry logic and preserves existing behavior for non-Kyogong bills.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause is database replication lag causing stale data in unpaid bills query.

**Test Plan**: Write tests that simulate the payment flow with artificial delays and database state manipulation. Run these tests on the UNFIXED code to observe the race condition and confirm bills remain in unpaid list despite successful payment.

**Test Cases**:
1. **Immediate Query Test**: Process Kyogong payment, immediately query unpaid bills (will show bill still unpaid on unfixed code)
2. **Delayed Query Test**: Process Kyogong payment, wait 2 seconds, query unpaid bills (may show correct state, confirming timing issue)
3. **Multiple Rapid Payments Test**: Process 3 Kyogong payments in quick succession, query unpaid bills (will show some or all bills still unpaid on unfixed code)
4. **Concurrent Cashier Test**: Simulate 2 cashiers paying different bills simultaneously, check if both see stale data (will fail on unfixed code)

**Expected Counterexamples**:
- Bills with `payment_method = 'BILL'` appear in unpaid list immediately after successful payment
- After 1-3 seconds, the same query returns updated data without the paid bill
- Possible causes: database replication lag, query result caching, eventual consistency

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (Kyogong bill payment completed), the fixed function produces the expected behavior (bill removed from unpaid list within 5 seconds).

**Pseudocode:**
```
FOR ALL payment WHERE isBugCondition(payment) DO
  result := handlePayment_fixed(payment)
  verification := verifyBillRemoved(payment.billNumber, 5)
  ASSERT verification.removed == true
  ASSERT verification.attempts <= 5
  ASSERT billNotInUnpaidList(payment.billNumber)
END FOR
```

**Test Cases**:
1. **Single Payment Verification**: Pay Kyogong bill, verify it's removed within 5 retry attempts
2. **Multiple Payments Verification**: Pay 5 Kyogong bills rapidly, verify all are removed within timeout
3. **Optimistic Update Test**: Verify bill is immediately removed from UI state before verification completes
4. **Retry Count Test**: Verify retry logic uses exponential backoff and doesn't exceed max attempts
5. **Error Recovery Test**: Simulate verification failure, verify user sees appropriate warning and can manually refresh

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (non-Kyogong bill payments), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL payment WHERE NOT isBugCondition(payment) DO
  ASSERT handlePayment_original(payment) = handlePayment_fixed(payment)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different bill types
- It catches edge cases that manual unit tests might miss (partial payments, mixed payment methods, etc.)
- It provides strong guarantees that behavior is unchanged for all non-Kyogong bills

**Test Plan**: Observe behavior on UNFIXED code first for restaurant/bar/hotel/invoice payments, then write property-based tests capturing that exact behavior and verify it's preserved after the fix.

**Test Cases**:
1. **Restaurant Bill Preservation**: Pay restaurant bill with CASH/MPESA/CARD, verify existing refresh logic works unchanged
2. **Bar Bill Preservation**: Pay bar bill, verify payment recording and receipt generation work unchanged
3. **Hotel Reservation Preservation**: Pay hotel bill, verify booking status updates work unchanged
4. **Invoice Preservation**: Pay invoice, verify invoice status and balance updates work unchanged
5. **Manual Unpaid Bill Preservation**: Pay manual unpaid bill, verify status transitions work unchanged
6. **Partial Payment Preservation**: Make partial payment on any bill type, verify balance calculation and UI updates work unchanged
7. **Receipt Generation Preservation**: Verify receipt modal displays correctly for all bill types after payment

### Unit Tests

- Test `verifyBillRemoved()` helper function with mocked API responses
- Test exponential backoff timing (100ms, 200ms, 400ms, 800ms, 1600ms)
- Test optimistic UI update removes bill from state immediately
- Test error recovery when verification fails after max attempts
- Test that non-Kyogong bills skip verification logic
- Test concurrent payment processing doesn't break verification

### Property-Based Tests

- Generate random Kyogong bill payments with varying amounts and payment methods, verify all are removed from unpaid list within timeout
- Generate random non-Kyogong bill payments across all bill types, verify payment processing behavior is identical to original code
- Generate random sequences of mixed bill type payments, verify correct verification logic is applied to each
- Test edge cases: very small amounts (KES 1), very large amounts (KES 1,000,000), partial payments, overpayments

### Integration Tests

- Test full payment flow: scan Kyogong bill → enter amount → select payment method → process payment → verify bill removed → show receipt
- Test multiple cashiers processing Kyogong payments simultaneously, verify all see updated unpaid lists
- Test network interruption during verification retry loop, verify graceful error handling
- Test switching between payment methods (CASH → MPESA → CARD) for same bill
- Test manual refresh button works correctly when verification fails
- Test that paid bills don't reappear after page refresh or tab switch
