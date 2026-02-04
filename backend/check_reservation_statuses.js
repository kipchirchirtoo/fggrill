const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function run() {
    try {
        const res = await pool.query('SELECT status, COUNT(*) FROM reservations GROUP BY status');
        console.log('Reservation Statuses:', res.rows);
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

run();
