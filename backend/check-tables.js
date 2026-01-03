
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
    const tables = [
        'simple_items',
        'stock_requests',
        'stock_request_items',
        'dispatch_notes',
        'dispatch_items',
        'branch_transfers',
        'suppliers',
        'vendor_performance',
        'budgets',
        'forecasts',
        'procurement_orders'
    ];

    console.log('Checking tables...');

    for (const table of tables) {
        try {
            const res = await pool.query(`SELECT to_regclass('public.${table}')`);
            if (res.rows[0].to_regclass) {
                const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`✅ Table '${table}' exists. Rows: ${count.rows[0].count}`);
            } else {
                console.log(`❌ Table '${table}' DOES NOT EXIST.`);
            }
        } catch (err) {
            console.error(`Error checking table '${table}':`, err.message);
        }
    }

    process.exit(0);
}

checkTables();
