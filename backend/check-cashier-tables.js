const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkTables() {
    const client = await pool.connect();
    try {
        // Check if cashier_logbooks table exists
        const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cashier_logbooks'
      );
    `);

        console.log('Table exists:', tableCheck.rows[0].exists);

        if (tableCheck.rows[0].exists) {
            // Check the column types
            const columnCheck = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cashier_logbooks'
        ORDER BY ordinal_position;
      `);

            console.log('\nTable columns:');
            columnCheck.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type}`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkTables();
