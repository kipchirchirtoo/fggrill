const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

async function getDetailedSchema() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const tables = ['branches', 'rooms', 'room_types', 'rate_plans', 'reservations', 'guests'];
    
    for (const table of tables) {
        console.log(`\n--- Columns for ${table} ---`);
        try {
            const res = await client.query(`SELECT * FROM ${table} LIMIT 0`);
            console.log(res.fields.map(f => f.name).join(', '));
        } catch (e) {
            console.log(`Table ${table} error: ${e.message}`);
        }
    }

    // Check if there's any data in branches
    console.log('\n--- Branches Data ---');
    const branches = await client.query('SELECT id, name, code FROM branches');
    console.log(branches.rows);

    await client.end();
}

getDetailedSchema();
