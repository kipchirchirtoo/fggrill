const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

async function checkEnum() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const res = await client.query(`
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'room_type'
    `);
    
    console.log('room_type enum values:', res.rows.map(r => r.enumlabel).join(', '));

    await client.end();
}

checkEnum().catch(console.error);
