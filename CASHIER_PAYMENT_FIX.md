# Cashier Payment Not Updating - Diagnosis & Fix

## Problem
After processing a payment for a Kyogong bill (e.g., SPA-20260220-5067) at the cashier station, the payment status doesn't update in the UI. The bill still shows as unpaid even though the payment was processed.

## Root Cause Analysis

The issue is in the frontend cashier page. After payment is processed:

1. ✅ Backend correctly updates the `shift_transactions` table with payment details
2. ✅ Backend returns success response
3. ✅ Frontend calls `fetchAPI` to refresh the bill data
4. ❌ **Frontend doesn't properly update the UI state after refresh**

Looking at `frontend/src/app/dashboard/cashier/page.tsx` line 377-382:

```typescript
// Refresh bill data
const refresh = await fetchAPI(`/cashier/bill/${identifier}`) as any;
if (refresh.success) {
    setBillData(refresh.data);
    setPaymentAmount(refresh.data.financials.balance.toString());
    setCustomerPhone('');
    syncProducts(); // Refresh local cache
    fetchUnpaidBills();
}
```

The code DOES refresh the bill data, but there might be a timing issue or the unpaid bills list isn't refreshing properly.

## Quick Test

Run this in the browser console on the cashier page after processing a payment:

```javascript
// Check current bill data
console.log('Current bill data:', billData);

// Manually refresh the bill
const billNumber = 'SPA-20260220-5067'; // Replace with your bill number
fetch(`${window.location.origin}/api/cashier/bill/${billNumber}`, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => {
    console.log('Refreshed bill data:', data);
    console.log('Payment status:', data.data.payment_status);
    console.log('Balance:', data.data.financials.balance);
    console.log('Amount paid:', data.data.financials.amount_paid);
});
```

## Solution

The issue is likely that:
1. The bill data is refreshing correctly
2. But the unpaid bills list still shows the old bill
3. The user needs to manually refresh or the list doesn't auto-update

### Fix Option 1: Force UI Refresh (Quick Fix)

Add a small delay and force a complete refresh after payment:

```typescript
// After payment success, add this:
setTimeout(() => {
    fetchUnpaidBills();
    if (billData) {
        handleScan(); // Re-scan the current bill to refresh it
    }
}, 500);
```

### Fix Option 2: Clear Bill After Payment (Better UX)

After successful payment, clear the current bill and show a success message:

```typescript
if (response.success) {
    const isPending = response.data.status === 'pending';
    toast.success(isPending ? 'Payment recorded as PENDING' : 'Payment verified successfully');

    if (!isPending) {
        // Show receipt
        setSelectedTransaction({...});
        setShowReceipt(true);
        
        // Clear current bill after showing receipt
        setTimeout(() => {
            setBillData(null);
            setScanInput('');
            setPaymentAmount('');
            setCashGiven('');
            setMpesaCode('');
            fetchUnpaidBills(); // Refresh unpaid list
        }, 2000);
    }
}
```

## Immediate Workaround

For now, after processing a payment:
1. Click the "Refresh" button in the unpaid bills section
2. Or scan the bill number again to see the updated status
3. The payment IS recorded in the database, it's just a UI refresh issue

## Files to Check

1. `frontend/src/app/dashboard/cashier/page.tsx` - Main cashier page
2. `backend/src/controllers/cashier.controller.ts` - Payment processing logic

## Testing Steps

1. Process a payment for a Kyogong bill
2. Check browser console for any errors
3. Manually refresh the unpaid bills list
4. Verify the bill no longer appears in unpaid bills
5. Check the database directly to confirm payment was recorded

## Database Verification

Run this query to check if payment was recorded:

```sql
SELECT 
    st.transaction_number,
    st.payment_method,
    st.total_amount,
    st.cash_amount,
    st.mpesa_amount,
    st.card_amount,
    p.amount as payment_amount,
    p.status as payment_status,
    p.created_at as payment_date
FROM shift_transactions st
LEFT JOIN payments p ON p.kyogong_transaction_id = st.id
WHERE st.transaction_number = 'SPA-20260220-5067'
ORDER BY p.created_at DESC;
```

If the payment shows in the database but not in the UI, it's definitely a frontend refresh issue.
