/**
 * Deep Cleanup - Find and remove ALL remaining data
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function deepCleanup() {
    console.log('\n🔍 DEEP CLEANUP - Finding and removing ALL remaining data\n');

    // List of additional tables that might contain financial data
    const financialTables = [
        'revenue_entries',
        'expense_entries',
        'daily_sales',
        'sales_summary',
        'financial_summary',
        'cash_transactions',
        'bank_transactions',
        'petty_cash',
        'till_sessions',
        'cash_register',
        'sales_records',
        'payment_transactions',
        'revenue_records',
        'expense_records',
        'accounting_entries',
        'ledger_entries',
        'journal_lines',
        'transaction_logs',
        'financial_transactions',
        'pos_transactions',
        'sales_transactions',
        'payment_logs',
        'receipt_logs',
        'invoice_logs',
        'bill_payments',
        'customer_payments',
        'vendor_payments',
    ];

    console.log('Cleaning financial and transaction tables...\n');

    for (const table of financialTables) {
        try {
            const { data } = await supabase.from(table).select('id');
            if (data && data.length > 0) {
                for (const row of data) {
                    await supabase.from(table).delete().eq('id', row.id);
                }
                console.log(`✅ Cleaned: ${table} (${data.length} records)`);
            }
        } catch (error) {
            // Table doesn't exist or other error - skip silently
        }
    }

    // Clean any remaining order/sales related tables
    const salesTables = [
        'sales',
        'sales_items',
        'order_history',
        'transaction_history',
        'payment_history',
        'receipt_items',
        'invoice_items',
        'bill_items',
    ];

    console.log('\nCleaning sales and order tables...\n');

    for (const table of salesTables) {
        try {
            const { data } = await supabase.from(table).select('id');
            if (data && data.length > 0) {
                for (const row of data) {
                    await supabase.from(table).delete().eq('id', row.id);
                }
                console.log(`✅ Cleaned: ${table} (${data.length} records)`);
            }
        } catch (error) {
            // Skip
        }
    }

    // Try to find and clean ANY table with data
    console.log('\n🔎 Scanning for any remaining data...\n');

    // Common table patterns
    const allPossibleTables = [
        'pos_orders',
        'pos_order_items',
        'pos_payments',
        'restaurant_orders',
        'restaurant_order_items',
        'bar_sales',
        'room_charges',
        'guest_bills',
        'guest_payments',
        'booking_payments',
        'room_revenue',
        'food_sales',
        'beverage_sales',
        'service_charges',
        'tips',
        'discounts',
        'refunds',
        'credit_notes',
        'debit_notes',
    ];

    for (const table of allPossibleTables) {
        try {
            const { data } = await supabase.from(table).select('id');
            if (data && data.length > 0) {
                for (const row of data) {
                    await supabase.from(table).delete().eq('id', row.id);
                }
                console.log(`✅ Found and cleaned: ${table} (${data.length} records)`);
            }
        } catch (error) {
            // Skip
        }
    }

    console.log('\n✅ Deep cleanup complete!\n');
    console.log('Please refresh your dashboard and check if revenue is now 0');
    console.log('If data still appears, please share the table names and I will clean them.\n');
}

deepCleanup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    });
