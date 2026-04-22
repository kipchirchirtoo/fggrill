const { Client } = require('pg');
require('dotenv').config();

async function checkConstraints() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        
        const result = await client.query(`
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name, 
                ccu.column_name AS foreign_column_name,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu 
                ON tc.constraint_name = kcu.constraint_name 
            JOIN information_schema.constraint_column_usage AS ccu 
                ON ccu.constraint_name = tc.constraint_name
            JOIN information_schema.referential_constraints AS rc
                ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' 
                AND ccu.table_name = 'guests'
            ORDER BY tc.table_name
        `);

        console.log('');
        console.log('========================================');
        console.log('Tables that reference guests:');
        console.log('========================================');
        console.log('');
        
        if (result.rows.length === 0) {
            console.log('No foreign key constraints found.');
        } else {
            result.rows.forEach(row => {
                console.log(`  ${row.table_name}.${row.column_name}`);
                console.log(`    -> ${row.foreign_table_name}.${row.foreign_column_name}`);
                console.log(`    ON DELETE: ${row.delete_rule}`);
                console.log('');
            });
        }
        
        console.log(`Total: ${result.rows.length} constraint(s)`);
        console.log('');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkConstraints();
