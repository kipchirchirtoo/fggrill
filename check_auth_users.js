/**
 * Check auth.users table
 */
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

async function checkAuthUsers() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, email, created_at 
            FROM auth.users;
        `);

        console.log(`\n👤 FOUND ${res.rows.length} USERS IN AUTH.USERS\n`);
        res.rows.forEach(u => {
            console.log(`- ${u.email} (${u.id})`);
        });

    } catch (err) {
        console.error('❌ Error checking auth users:', err.message);
    } finally {
        await client.end();
    }
}

checkAuthUsers();
