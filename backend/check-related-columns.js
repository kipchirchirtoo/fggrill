
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    const tables = ['accounting_ar_invoices', 'accounting_ap_bills', 'pos_transactions', 'reservations', 'restaurant_orders', 'bar_orders'];

    try {
        for (const table of tables) {
            const res = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1 AND column_name = 'branch_id';
            `, [table]);

            if (res.rows.length > 0) {
                console.log(`✅ ${table} has branch_id`);
            } else {
                console.log(`❌ ${table} MISSING branch_id`);
            }
        }
    } catch (err) {
        console.error('Error querying columns:', err.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
