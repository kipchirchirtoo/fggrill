
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkBranches() {
    try {
        const res = await pool.query('SELECT id, name FROM branches');
        console.log('Branches:');
        res.rows.forEach(r => console.log(`${r.id}: ${r.name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkBranches();
