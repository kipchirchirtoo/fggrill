
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'accounting_ar_invoices'
            ORDER BY column_name;
        `);

        console.log('Columns in accounting_ar_invoices table:');
        if (res.rows.length === 0) {
            console.log('Table found no columns or does not exist.');
        } else {
            res.rows.forEach(row => {
                console.log(`${row.column_name} (${row.data_type})`);
            });
        }
    } catch (err) {
        console.error('Error querying columns:', err.message);
    } finally {
        await pool.end();
    }
}

checkColumns();
