const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkPaymentsFKs() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database\n');

        // Check all FK constraints on payments table
        const fkQuery = `
            SELECT 
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table,
                ccu.column_name AS foreign_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu 
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.table_name = 'payments' 
                AND tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.constraint_name;
        `;

        const fkResult = await client.query(fkQuery);
        console.log('Foreign Key Constraints on payments table:');
        console.log(JSON.stringify(fkResult.rows, null, 2));

        // Check all columns in payments table
        const columnsQuery = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'payments'
            ORDER BY ordinal_position;
        `;

        const columnsResult = await client.query(columnsQuery);
        console.log('\n\nAll columns in payments table:');
        console.log(JSON.stringify(columnsResult.rows, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

checkPaymentsFKs();
