const { Client } = require('pg');
require('dotenv').config();

async function listColumns() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'staff_profiles'
            ORDER BY ordinal_position;
        `);
        console.log('Columns in staff_profiles:');
        res.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
    } catch (err) {
        console.error('Failed to list columns:', err.message);
    } finally {
        await client.end();
    }
}

listColumns();
