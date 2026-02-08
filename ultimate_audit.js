/**
 * Ultimate Database Audit - Scan EVERY table for data
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

async function ultimateAudit() {
    console.log('\n🕵️ ULTIMATE DATABASE AUDIT - Scanning ALL tables\n');

    // Since we can't easily list all tables via the JS client without RPC,
    // we'll use a list of known tables from the migration files and previous scans.
    // Actually, let's try to find them from the schema if possible.

    const knownTables = [
        'users', 'staff_profiles', 'branches', 'departments', 'user_roles',
        'reservations', 'reservation_rooms', 'rooms', 'room_types', 'folios',
        'restaurant_orders', 'restaurant_order_items', 'menu_items', 'menu_categories',
        'bar_orders', 'bar_order_items', 'bar_tabs',
        'inventory_items', 'inventory_categories', 'suppliers', 'stock_levels', 'stock_history',
        'stock_requests', 'stock_request_items', 'branch_inventory',
        'payments', 'accounting_ar_invoices', 'unpaid_bills', 'pos_transactions',
        'staff_attendance', 'staff_leave', 'staff_payroll', 'staff_performance',
        'outside_catering_bookings', 'outside_catering_items',
        'maintenance_tasks', 'housekeeping_log',
        'audit_night_sessions', 'audit_exceptions', 'audit_trail', 'audit_plans', 'audit_findings', 'auditor_watchlist',
        'revenue_tracking', 'daily_collections', 'variance_records'
    ];

    const results = [];
    for (const table of knownTables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (!error) {
                results.push({ table, count });
            }
        } catch (e) { }
    }

    console.log('--- TABLES WITH DATA ---');
    results.filter(r => r.count > 0).forEach(r => {
        let status = '⚠️';
        if (r.table === 'users') {
            status = r.count === 1 ? '✅ (Superadmin only)' : '🚨 (Multiple users!)';
        } else if (['branches', 'departments', 'menu_items', 'menu_categories', 'rooms', 'room_types', 'inventory_categories'].includes(r.table)) {
            status = 'ℹ️ (Configuration/Master Data)';
        }
        console.log(`${status} ${r.table}: ${r.count} records`);
    });

    console.log('\n--- CLEAN TABLES ---');
    console.log(results.filter(r => r.count === 0).map(r => r.table).join(', '));

    console.log('\nAudit complete.');
}

ultimateAudit();
