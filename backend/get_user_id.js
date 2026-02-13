const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function getUserId() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT id, email, branch_id FROM users LIMIT 1");
        console.log('ID:', res.rows[0].id);
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

getUserId();
