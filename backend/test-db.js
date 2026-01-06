const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    console.log('Testing connection with pure JS...');
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Success:', res.rows[0]);
    } catch (err) {
        console.error('Failure:', err.message);
    }
    await pool.end();
    process.exit(0);
}

test();
