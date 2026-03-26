const { Client } = require('pg');
const fs = require('fs');
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
            WHERE schemaname = 'public' AND tablename LIKE 'staff_%'
            ORDER BY tablename;
        `);
        const tables = res.rows.map(r => r.tablename).join('\n');
        fs.writeFileSync('staff_tables_list.txt', tables);
        console.log('Tables written to staff_tables_list.txt');
    } catch (err) {
        console.error('Failed to list tables:', err.message);
    } finally {
        await client.end();
    }
}

listStaffTables();
