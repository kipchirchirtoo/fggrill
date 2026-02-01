const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const tables = ['stock_requests', 'stock_request_items', 'simple_items', 'branch_stock'];

        for (const table of tables) {
            const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}'
        ORDER BY ordinal_position
      `);
            console.log(`--- ${table} columns ---`);
            console.table(res.rows);
        }

        const requests = await pool.query(`
      SELECT id, request_number, status, requesting_branch_id FROM stock_requests LIMIT 5
    `);
        console.log('--- Sample stock_requests ---');
        console.table(requests.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchema();
