const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testJoin() {
    try {
        const res = await pool.query(`
      SELECT 
        sr.*, 
        b.name as branch_name 
      FROM stock_requests sr
      LEFT JOIN branches b ON sr.requesting_branch_id = b.id
      LIMIT 5
    `);
        console.log('--- JOIN result ---');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

testJoin();
