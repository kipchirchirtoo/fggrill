const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    const tables = ['staff_payroll', 'payroll_records'];
    for (const table of tables) {
        try {
            const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
            console.log(`\nTable: ${table}`);
            if (res.rows.length === 0) {
                console.log('  (No columns found, might be a view or not exist)');
            }
            res.rows.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
        } catch (err) {
            console.error(`Error inspecting ${table}:`, err.message);
        }
    }
    process.exit(0);
}

run();
