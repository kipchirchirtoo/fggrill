const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

async function expandEnum() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const newValues = ['Deluxe Twin', 'Executive', 'VIP Suite', 'Cottage', 'Conference Hall'];
    
    for (const val of newValues) {
        try {
            // Check if value already exists
            const check = await client.query(`
                SELECT 1 FROM pg_enum 
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
                WHERE pg_type.typname = 'room_type' AND enumlabel = $1
            `, [val]);
            
            if (check.rows.length === 0) {
                console.log(`Adding ${val} to room_type enum...`);
                await client.query(`ALTER TYPE room_type ADD VALUE '${val}'`);
            } else {
                console.log(`${val} already exists in enum.`);
            }
        } catch (e) {
            console.error(`Failed to add ${val}:`, e.message);
        }
    }

    await client.end();
}

expandEnum().catch(console.error);
