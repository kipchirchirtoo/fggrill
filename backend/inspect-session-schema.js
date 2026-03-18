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
        
        // Columns for audit_night_sessions
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_night_sessions'
        `);
        results.audit_night_sessions_columns = res.rows;

        // Foreign Keys for audit_night_sessions
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
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='audit_night_sessions';
        `);
        results.audit_night_sessions_fks = res2.rows;

        fs.writeFileSync('session-schema-results.json', JSON.stringify(results, null, 2));
        console.log('Results written to session-schema-results.json');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

inspect();
