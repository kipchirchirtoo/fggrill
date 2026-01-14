const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkRoles() {
    try {
        console.log('🔍 Checking user_role enum values...');
        const result = await pool.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
      ORDER BY enumlabel;
    `);

        console.log('Result:', result.rows.map(r => r.enumlabel));

        console.log('\n🔍 Checking if kitchen_operations table exists...');
        const tableResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'kitchen_stock';
    `);
        console.log('Kitchen Stock Table exists:', tableResult.rows.length > 0);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkRoles();
