const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
    try {
        const tables = ['suppliers', 'accounting_vendors', 'store_suppliers', 'vendors'];
        console.log("Checking record counts for vendor-related tables:");

        for (const table of tables) {
            try {
                const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`${table}: ${res.rows[0].count} records`);
            } catch (e) {
                console.log(`${table}: Table not found or error: ${e.message}`);
            }
        }

        console.log("\nChecking schema for suppliers table:");
        const schemaRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'suppliers'
    `);
        console.log(JSON.stringify(schemaRes.rows, null, 2));

        console.log("\nChecking schema for accounting_ap_bills table:");
        const billsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'accounting_ap_bills'
    `);
        console.log(JSON.stringify(billsRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkCounts();
