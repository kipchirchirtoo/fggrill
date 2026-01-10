const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });

async function checkDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const tables = ['suppliers', 'accounting_vendors', 'accounting_ap_bills'];
        for (const table of tables) {
            try {
                const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`${table}: ${res.rows[0].count} records`);
            } catch (err) {
                console.log(`${table}: Error or not found: ${err.message}`);
            }
        }

        console.log('\nSample from suppliers (up to 5):');
        const suppliers = await client.query('SELECT id, name FROM suppliers LIMIT 5');
        console.table(suppliers.rows);

        console.log('\nSample from accounting_vendors (up to 5):');
        const accVendors = await client.query('SELECT id, vendor_name, vendor_code FROM accounting_vendors LIMIT 5');
        console.table(accVendors.rows);

    } catch (err) {
        console.error('Connection error:', err.message);
    } finally {
        await client.end();
    }
}

checkDatabase();
