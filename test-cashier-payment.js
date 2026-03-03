/**
 * Test script to diagnose cashier payment issues
 * Run this in the browser console on the cashier page
 */

// Test 1: Check if API_URL is correct
console.log('=== API Configuration Test ===');
console.log('Current page:', window.location.href);

// Test 2: Try to fetch a bill
const testBillNumber = 'SPA-20260220-5067'; // Replace with actual bill number
console.log(`\n=== Testing Bill Fetch for ${testBillNumber} ===`);

fetch(`${window.location.origin}/api/cashier/bill/${testBillNumber}`, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => {
    console.log('Bill fetch result:', data);
    if (data.success) {
        console.log('✅ Bill fetched successfully');
        console.log('Bill type:', data.data.type);
        console.log('Balance:', data.data.financials?.balance);
        console.log('Amount paid:', data.data.financials?.amount_paid);
    } else {
        console.error('❌ Bill fetch failed:', data.error);
    }
})
.catch(err => {
    console.error('❌ Network error:', err);
});

// Test 3: Check unpaid bills endpoint
console.log('\n=== Testing Unpaid Bills Endpoint ===');
fetch(`${window.location.origin}/api/cashier/unpaid-bills`, {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => {
    console.log('Unpaid bills result:', data);
    if (data.success) {
        console.log(`✅ Found ${data.data.length} unpaid bills`);
        console.log('Bills:', data.data.map(b => ({
            number: b.bill_number || b.order_number,
            balance: b.balance || b.financials?.balance,
            module: b.module
        })));
    } else {
        console.error('❌ Unpaid bills fetch failed:', data.error);
    }
})
.catch(err => {
    console.error('❌ Network error:', err);
});

console.log('\n=== Tests Complete ===');
console.log('Check the results above to diagnose the issue');
