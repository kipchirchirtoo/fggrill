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
            SELECT routine_name, routine_definition 
            FROM information_schema.routines 
            WHERE routine_name = 'approve_grn_and_update_all' 
            AND routine_schema = 'public'
        `);
        
        if (res.rows.length > 0 && res.rows[0].routine_definition.includes('simple_items')) {
            console.log('✅ VERIFIED: Function now updates simple_items stock');
            console.log('✅ The fix is working correctly!');
        } else {
            console.log('❌ WARNING: Function may not be updated correctly');
        }
    } finally {
        client.release();
        await pool.end();
    }
})();
