
const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('drivers', 'vehicles', 'store_suppliers', 'staff_profiles')
        `);
        console.log('Tables found:', res.rows.map(r => r.table_name));

        for (const table of res.rows.map(r => r.table_name)) {
            const cols = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = '${table}'
            `);
            console.log(`\nColumns in ${table}:`);
            cols.rows.forEach(c => console.log(`- ${c.column_name} (${c.data_type}) [Nullable: ${c.is_nullable}] [Default: ${c.column_default}]`));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkTables();
