const { Client } = require('pg');
require('dotenv').config();

async function inspectSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('staff_monthly_statutory_deductions', 'staff_payroll_adjustments')
            ORDER BY table_name, ordinal_position;
        `);
        console.log('Schemas:');
        res.rows.forEach(row => {
            console.log(`${row.table_name}.${row.column_name}: ${row.data_type}`);
        });
    } catch (err) {
        console.error('Failed to inspect schema:', err.message);
    } finally {
        await client.end();
    }
}

inspectSchema();
