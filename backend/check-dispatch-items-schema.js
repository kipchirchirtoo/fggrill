const { Client } = require('pg');
require('dotenv').config();

async function checkSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        
        const result = await client.query(`
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'dispatch_items' 
            ORDER BY ordinal_position
        `);

        console.log('');
        console.log('========================================');
        console.log('Current dispatch_items table columns:');
        console.log('========================================');
        console.log('');
        
        result.rows.forEach(row => {
            const type = row.character_maximum_length 
                ? `${row.data_type}(${row.character_maximum_length})`
                : row.data_type;
            console.log(`  ${row.column_name.padEnd(30)} ${type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
        console.log('');
        console.log(`Total columns: ${result.rows.length}`);
        console.log('');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkSchema();
