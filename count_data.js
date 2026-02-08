/**
 * Count script to find where data is hiding
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

async function countData() {
    const tables = [
        'payments',
        'outside_catering_bookings',
        'unpaid_bills',
        'pos_transactions',
        'restaurant_orders',
        'bar_orders',
        'restaurant_pool_token_sales',
        'reservations',
        'accounting_ar_invoices',
        'audit_night_sessions',
        'audit_exceptions',
        'audit_trail',
        'audit_plans',
        'audit_findings',
        'auditor_watchlist'
    ];

    console.log('\n📊 RECORD COUNTS\n');
    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`❌ ${table}: ${error.message}`);
            } else {
                console.log(`${count > 0 ? '🚨' : '✅'} ${table}: ${count} records`);
                if (count > 0) {
                    // Get a sum of amounts if possible
                    if (table === 'payments' || table === 'restaurant_orders' || table === 'bar_orders') {
                        const amountCol = (table === 'bar_orders') ? 'total' : 'amount';
                        // Actually sum() is not directly available in supabase-js select, must use rpc or fetch all
                        const { data } = await supabase.from(table).select(amountCol || 'total_amount').limit(100);
                    }
                }
            }
        } catch (e) {
            console.log(`❓ ${table}: Table might not exist`);
        }
    }
}

countData();
