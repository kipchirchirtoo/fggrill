/**
 * Clear ALL transaction/audit tables and then clear auth.users EXCEPT superadmin
 */
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function ultimateCleanup() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    const superadminEmail = 'kipchirchirtoo01@gmail.com';

    try {
        await client.connect();
        console.log('Connecting to database...');

        // 1. Find Superadmin
        const { rows } = await client.query('SELECT id FROM auth.users WHERE email = $1', [superadminEmail]);
        if (rows.length === 0) {
            console.error(`❌ Error: Superadmin ${superadminEmail} not found. Aborting.`);
            return;
        }
        const superadminId = rows[0].id;
        console.log(`Verified superadmin: ${superadminId}`);

        // 2. Clear all blocking tables (Transaction/Audit/History)
        const blockingTables = [
            'room_status_history',
            'audit_night_sessions',
            'audit_plans',
            'audit_findings',
            'auditor_watchlist',
            'audit_exceptions',
            'audit_trail',
            'pos_transactions',
            'payments',
            'restaurant_orders',
            'bar_orders',
            'staff_employment_history',
            'stock_counts'
        ];

        console.log('Clearing blocking tables...');
        for (const table of blockingTables) {
            try {
                const res = await client.query(`DELETE FROM public.${table}`);
                console.log(`   - Cleared ${res.rowCount} rows from ${table}`);
            } catch (err) {
                // Table might not exist or have different schema, skip
                console.log(`   - Skip ${table}: ${err.message}`);
            }
        }

        // 3. Clear public.users profiles first (except superadmin)
        console.log('Clearing public.users profiles...');
        const publicUsersRes = await client.query('DELETE FROM public.users WHERE id != $1', [superadminId]);
        console.log(`   - Removed ${publicUsersRes.rowCount} profile records.`);

        // 4. Clear auth.users (except superadmin)
        console.log('Final cleanup of auth.users...');
        const authUsersRes = await client.query('DELETE FROM auth.users WHERE id != $1', [superadminId]);
        console.log(`✅ Successfully removed ${authUsersRes.rowCount} users from auth.users.`);

        console.log('🚀 SYSTEM IS NOW FULLY RESET (PRESERVING SUPERADMIN)');

    } catch (err) {
        console.error('❌ Error during ultimate cleanup:', err.message);
    } finally {
        await client.end();
    }
}

ultimateCleanup();
