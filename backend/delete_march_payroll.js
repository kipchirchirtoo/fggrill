const { Client } = require('pg');
require('dotenv').config();

async function deleteMarch() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Deleting payroll run for March 2026...');
        const res = await client.query("DELETE FROM payroll_runs WHERE month = 3 AND year = 2026;");
        console.log(`Deleted ${res.rowCount} rows from payroll_runs.`);
    } catch (err) {
        console.error('Deletion failed:', err.message);
    } finally {
        await client.end();
    }
}

deleteMarch();
