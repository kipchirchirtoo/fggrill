/**
 * Verify trigger function definition
 */
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function verifyFix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT pg_get_functiondef(p.oid) 
            FROM pg_proc p 
            INNER JOIN pg_namespace n ON n.oid = p.pronamespace 
            WHERE n.nspname = 'public' 
            AND p.proname = 'handle_new_user';
        `);

        if (res.rows.length > 0) {
            console.log('--- Current function definition ---\n');
            console.log(res.rows[0].pg_get_functiondef);
            if (res.rows[0].pg_get_functiondef.includes("'User'") && res.rows[0].pg_get_functiondef.includes("'Account'")) {
                console.log('\n✅ Verification successful: Placeholders are present.');
            } else {
                console.log('\n❌ Verification failed: Placeholders NOT found.');
            }
        } else {
            console.log('❌ Function handle_new_user not found.');
        }
    } catch (err) {
        console.error('❌ Error verifying fixation:', err.message);
    } finally {
        await client.end();
    }
}

verifyFix();
