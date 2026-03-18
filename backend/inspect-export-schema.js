const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    const results = {};
    try {
        await client.connect();
        
        // Columns for stock_requests
        const res1 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stock_requests'
        `);
        results.stock_requests_columns = res1.rows;

        // Foreign Keys for stock_requests
        const res2 = await client.query(`
            SELECT
                tc.constraint_name, 
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
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='stock_requests';
        `);
        results.stock_requests_fks = res2.rows;

        // Columns for audit_exceptions
        const res3 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_exceptions'
        `);
        results.audit_exceptions_columns = res3.rows;

        // Foreign Keys for audit_exceptions
        const res4 = await client.query(`
            SELECT
                tc.constraint_name, 
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
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='audit_exceptions';
        `);
        results.audit_exceptions_fks = res4.rows;

        fs.writeFileSync('schema-results.json', JSON.stringify(results, null, 2));
        console.log('Results written to schema-results.json');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspect();
