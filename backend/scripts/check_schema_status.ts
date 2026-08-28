
import { Pool } from 'pg';

const dbUrl = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    const client = await pool.connect();
    try {
        console.log('🔍 Checking User Profile Schema...');
        const userRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('employee_id', 'department', 'shift', 'start_date', 'emergency_contact', 'status');
        `);
        console.log('Found User columns:', userRes.rows.map(r => r.column_name));

        console.log('🔍 Checking Kitchen Schema...');
        const kitchenRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('kitchen_items', 'kitchen_inventory', 'kitchen_movement_logs');
        `);
        console.log('Found Kitchen tables:', kitchenRes.rows.map(r => r.table_name));

    } catch (err: any) {
        console.error('❌ Check failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkSchema();
