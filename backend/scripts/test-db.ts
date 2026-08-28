import { pool } from '../src/config/pg';

async function test() {
    console.log('Testing connection...');
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('Success:', res.rows[0]);
    } catch (err) {
        console.error('Failure:', err.message);
    }
    process.exit(0);
}

test();
