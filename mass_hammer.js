/**
 * Mass Hammer Cleanup - Aggressively remove EVERY record from EVERY identified table
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

async function massHammer() {
    const tables = [
        'payments',
        'outside_catering_bookings',
        'unpaid_bills',
        'pos_transactions',
        'restaurant_orders',
        'restaurant_order_items',
        'bar_orders',
        'bar_order_items',
        'bar_tabs',
        'accounting_ar_invoices',
        'audit_night_sessions',
        'audit_exceptions',
        'audit_trail',
        'audit_plans',
        'audit_findings',
        'auditor_watchlist',
        'staff_employment_history',
        'stock_counts'
    ];

    console.log('\n🔨 MASS HAMMER CLEANUP STARTING...\n');

    for (const table of tables) {
        console.log(`⏳ Processing: ${table}...`);
        try {
            // Get the first few rows to see columns if deletion fails
            const { data: sample } = await supabase.from(table).select('*').limit(1);

            // Attempt broad deletion first
            // .neq('id', '0') works for UUIDs that are non-zero, but might fail.
            // .gte('created_at', '1900-01-01') is very broad.
            // Easiest is to select all IDs and delete them.

            const { data: allRows } = await supabase.from(table).select('*');

            if (allRows && allRows.length > 0) {
                console.log(`   Found ${allRows.length} records. Deleting...`);
                let deletedCount = 0;

                for (const row of allRows) {
                    // Find the primary key - usually 'id' or 'sku' or combined
                    const pk = row.id ? 'id' : (row.sku ? 'sku' : (row.uuid ? 'uuid' : null));

                    if (pk) {
                        const { error } = await supabase.from(table).delete().eq(pk, row[pk]);
                        if (!error) deletedCount++;
                    } else {
                        // If no obvious PK, try deleting by whatever first column we have
                        const firstCol = Object.keys(row)[0];
                        const { error } = await supabase.from(table).delete().eq(firstCol, row[firstCol]);
                        if (!error) deletedCount++;
                    }
                }
                console.log(`   ✅ Successfully removed ${deletedCount} records from ${table}`);
            } else {
                console.log(`   ✅ ${table} is already empty.`);
            }
        } catch (error) {
            console.log(`   ❌ Error on ${table}: ${error.message}`);
        }
    }

    // Double check the specific tables the user saw data from
    console.log('\n🔎 Final Check...');
    const checkTables = ['payments', 'restaurant_orders', 'pos_transactions'];
    for (const table of checkTables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`   ${table}: ${count || 0} records remaining`);
    }

    console.log('\n🚀 MASS HAMMER COMPLETE! 🚀');
    console.log('Please refresh your dashboard. Revenue should now be KES 0.');
}

massHammer();
