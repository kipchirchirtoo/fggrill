const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

(async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'store_grn' 
            AND column_name IN ('id', 'approved_by_id')
        `);
        console.log('store_grn columns:');
        res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
        
        const res2 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'store_grn_items' 
            AND column_name = 'item_id'
        `);
        console.log('\nstore_grn_items columns:');
        res2.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
    } finally {
        client.release();
        await pool.end();
    }
})();
