const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
    try {
        const res = await pool.query(`
      SELECT email, role::text, branch_id 
      FROM users 
      WHERE role::text LIKE '%admin%' OR role::text LIKE '%storekeeper%' OR role::text LIKE '%manager%'
      LIMIT 20
    `);
        console.log('--- Relevant Users ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUsers();
