const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspectTable() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Check if 'payments' table exists and list columns
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'payments';
        `);

        if (res.rows.length === 0) {
            console.log("Table 'payments' not found.");

            // Check for finance_payments just in case
            const res2 = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'finance_payments';
            `);
            if (res2.rows.length > 0) {
                console.log("Found 'finance_payments' table instead:");
                console.table(res2.rows);
            }
        } else {
            console.log("Found 'payments' table columns:");
            console.table(res.rows);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

inspectTable();
