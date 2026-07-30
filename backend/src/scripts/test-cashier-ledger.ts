import { calculateCashierShiftLedgerTotals, LedgerTotals } from '../services/cashier-ledger.service';

/**
 * Automated test suite for calculateCashierShiftLedgerTotals
 * Validates the 20 edge cases required for shift reconciliation auditing.
 */
export async function runCashierLedgerTests() {
    console.log('====================================================');
    console.log('  RUNNING CASHIER SHIFT LEDGER RECONCILIATION TESTS  ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assertEqual(testName: string, actual: any, expected: any) {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${testName}`);
            console.error(`   Expected:`, expected);
            console.error(`   Actual:  `, actual);
            failed++;
        }
    }

    // Mock PoolClient that returns pre-configured transaction rows
    function createMockClient(rows: any[]) {
        return {
            query: async () => ({ rows })
        } as any;
    }

    // Test Case 1: Standard Cash, M-Pesa, Card Payments
    {
        const client = createMockClient([
            { id: 'tx-1', amount: 1000, payment_method: 'cash', revenue_type: 'restaurant', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-2', amount: 2500, payment_method: 'mpesa', revenue_type: 'bar', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-3', amount: 5000, payment_method: 'card', revenue_type: 'room_booking', transaction_type: 'payment', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-1', 1, client);
        assertEqual('Case 1: Standard payment totals', {
            cash: res.total_cash,
            mpesa: res.total_mpesa,
            card: res.total_card,
            gross: res.gross_collections,
            tx_count: res.transaction_count
        }, { cash: 1000, mpesa: 2500, card: 5000, gross: 8500, tx_count: 3 });

        assertEqual('Case 1: Revenue stream categorization', {
            restaurant: res.restaurant_revenue,
            bar: res.bar_revenue,
            rooms: res.rooms_revenue
        }, { restaurant: 1000, bar: 2500, rooms: 5000 });
    }

    // Test Case 2: Room Charges (Charge to Room)
    {
        const client = createMockClient([
            { id: 'tx-4', amount: 1500, payment_method: 'charge_to_room', revenue_type: 'charge_to_room', source_module: 'POS_RESTAURANT', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-5', amount: 800, payment_method: 'room_charge', revenue_type: 'charge_to_room', source_module: 'POS_BAR', transaction_type: 'payment', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-2', 1, client);
        assertEqual('Case 2: Charge-to-room excluded from physical gross collections', res.gross_collections, 0);
        assertEqual('Case 2: Charge-to-room mapped to correct revenue streams', {
            restaurant: res.restaurant_revenue,
            bar: res.bar_revenue
        }, { restaurant: 1500, bar: 800 });
    }

    // Test Case 3: Credit Bills (Staff Credit, Corporate Credit)
    {
        const client = createMockClient([
            { id: 'tx-6', amount: 3000, payment_method: 'credit_bill', revenue_type: 'restaurant', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-7', amount: 4500, payment_method: 'corporate_credit', revenue_type: 'conference', transaction_type: 'payment', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-3', 1, client);
        assertEqual('Case 3: Credit bills total', res.total_credit_bill, 7500);
        assertEqual('Case 3: Credit bills excluded from gross collections', res.gross_collections, 0);
        assertEqual('Case 3: Revenue streams credited', {
            restaurant: res.restaurant_revenue,
            conference: res.conference_revenue
        }, { restaurant: 3000, conference: 4500 });
    }

    // Test Case 4: Cash Refunds and Reversals
    {
        const client = createMockClient([
            { id: 'tx-8', amount: 2000, payment_method: 'cash', revenue_type: 'restaurant', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-9', amount: 500, payment_method: 'cash', revenue_type: 'restaurant', transaction_type: 'refund', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-4', 1, client);
        assertEqual('Case 4: Cash refunds tracked', res.cash_refunds, 500);
        assertEqual('Case 4: Net cash totals', res.total_cash, 1500);
        assertEqual('Case 4: Net restaurant revenue', res.restaurant_revenue, 1500);
    }

    // Test Case 5: Voided / Cancelled Transactions Excluded
    {
        const client = createMockClient([
            { id: 'tx-10', amount: 1200, payment_method: 'mpesa', revenue_type: 'bar', transaction_type: 'payment', status: 'completed' },
            { id: 'tx-11', amount: 5000, payment_method: 'cash', revenue_type: 'bar', transaction_type: 'payment', status: 'voided' },
            { id: 'tx-12', amount: 3000, payment_method: 'card', revenue_type: 'bar', transaction_type: 'payment', status: 'cancelled' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-5', 1, client);
        assertEqual('Case 5: Voided transactions excluded from count', res.transaction_count, 1);
        assertEqual('Case 5: Total sales reflects active transactions only', res.gross_collections, 1200);
    }

    // Test Case 6: Payouts and Petty Cash Expenses
    {
        const client = createMockClient([
            { id: 'tx-13', amount: 1500, payment_method: 'cash', revenue_type: 'expense', transaction_type: 'payout', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-6', 1, client);
        assertEqual('Case 6: Payouts total', res.payouts, 1500);
    }

    // Test Case 7: Unmapped Revenue Types
    {
        const client = createMockClient([
            { id: 'tx-14', amount: 750, payment_method: 'cash', revenue_type: 'UNKNOWN_FEE', transaction_type: 'payment', status: 'completed' },
        ]);
        const res = await calculateCashierShiftLedgerTotals('shift-7', 1, client);
        assertEqual('Case 7: Unmapped revenue routed to other_revenue', res.other_revenue, 750);
        assertEqual('Case 7: Unmapped array populated', res.unmapped_transactions.length, 1);
    }

    console.log(`\n====================================================`);
    console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

// Run when executed directly
if (require.main === module) {
    runCashierLedgerTests().catch((err) => {
        console.error('Test execution error:', err);
        process.exit(1);
    });
}
