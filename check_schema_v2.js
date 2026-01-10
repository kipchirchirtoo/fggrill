const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const tables = ['accounting_ar_invoices', 'accounting_bank_transactions', 'accounting_customers', 'customers', 'users'];
        console.log("Checking schemas for relevant tables:");

        for (const table of tables) {
            try {
                console.log(`\n--- ${table} ---`);
                const res = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = '${table}'
          ORDER BY ordinal_position
        `);
                if (res.rows.length === 0) {
                    console.log("Table not found.");
                } else {
                    res.rows.forEach(col => console.log(`${col.column_name}: ${col.data_type}`));
                }
            } catch (e) {
                console.log(`Error checking schema for ${table}: ${e.message}`);
            }
        }

        console.log("\nChecking for foreign key constraints on accounting_ar_invoices:");
        const fkRes = await pool.query(`
      SELECT
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.key_column_usage AS kcu 
          JOIN information_schema.constraint_column_usage AS ccu 
            ON ccu.constraint_name = kcu.constraint_name 
      WHERE kcu.table_name = 'accounting_ar_invoices';
    `);
        console.log(JSON.stringify(fkRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
