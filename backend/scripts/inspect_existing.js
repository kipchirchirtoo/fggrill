const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect(table) {
    try {
        const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}';`);
        console.log(`\n--- ${table} ---`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(`Error inspecting ${table}:`, err.message);
    }
}

async function start() {
    await inspect('staff_attendance');
    await inspect('bar_stock');
    process.exit(0);
}

start();
