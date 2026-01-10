const { Pool } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkConstraint() {
    try {
        const res = await pool.query(`
      SELECT
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
      FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'accounting_ap_bills'
        AND kcu.column_name = 'vendor_id';
    `);

        console.log("Constraint info for accounting_ap_bills(vendor_id):");
        console.log(JSON.stringify(res.rows, null, 2));

        // Also check available tables
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%vendor%' OR table_name LIKE '%supplier%');
    `);
        console.log("\nAvailable vendor/supplier tables:");
        console.log(JSON.stringify(tables.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkConstraint();
