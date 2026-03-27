const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

async function getDetailedSchema() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const tables = ['branches', 'rooms', 'room_types', 'rate_plans', 'reservations', 'guests'];
    
    for (const table of tables) {
        try {
            const res = await client.query(`SELECT * FROM ${table} LIMIT 0`);
            console.log(`\nTABLE: ${table}`);
            console.log(`COLUMNS: ${res.fields.map(f => f.name).join(', ')}`);
        } catch (e) {
            console.log(`\nTABLE: ${table} - ERROR: ${e.message}`);
        }
    }

    await client.end();
}

getDetailedSchema();
