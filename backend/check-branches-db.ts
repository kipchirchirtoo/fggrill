
import { pool } from './src/config/pg';

async function checkBranches() {
    try {
        const res = await pool.query('SELECT * FROM branches');
        console.log('Branches found:', res.rows.length);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('Error querying branches:', err);
    } finally {
        await pool.end();
    }
}

checkBranches();
