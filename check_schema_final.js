const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

async function checkSchema() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const tables = ['rooms', 'room_types', 'rate_plans', 'conference_halls'];
    
    for (const table of tables) {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY ordinal_position
        `, [table]);
        
        console.log(`\nTABLE: ${table}`);
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });
    }

    await client.end();
}

checkSchema().catch(console.error);
