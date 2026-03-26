const { Client } = require('pg');
require('dotenv').config();

async function listStaffTables() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public' AND tablename LIKE 'staff_%';
        `);
        console.log('Staff-related tables:');
        res.rows.forEach(row => {
            console.log(row.tablename);
        });
    } catch (err) {
        console.error('Failed to list tables:', err.message);
    } finally {
        await client.end();
    }
}

listStaffTables();
