const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');

async function listColumns() {
    const client = new Client({
        connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'staff_profiles'
            ORDER BY ordinal_position;
        `);
        let output = 'Columns in staff_profiles:\n';
        res.rows.forEach(row => {
            output += `${row.column_name}: ${row.data_type}\n`;
        });
        fs.writeFileSync('cols.txt', output);
        console.log('Done!');
    } catch (err) {
        console.error('Failed to list columns:', err.message);
    } finally {
        await client.end();
    }
}

listColumns();
