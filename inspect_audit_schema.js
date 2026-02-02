const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function inspectSchema() {
    const tables = ['restaurant_orders', 'bar_orders', 'payments', 'expenses', 'stock_requests', 'branches'];

    try {
        for (const table of tables) {
            console.log(`\n--- Schema for ${table} ---`);
            const res = await pool.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position;
            `, [table]);
            console.table(res.rows);
        }

        console.log(`\n--- Payment Methods in payments table ---`);
        const methods = await pool.query(`
            SELECT DISTINCT payment_method FROM payments;
        `);
        console.table(methods.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

inspectSchema();
