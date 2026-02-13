const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function getUser() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Get a cashier user
        const res = await client.query("SELECT id, email, password, role, branch_id FROM users WHERE role = 'cashier' LIMIT 1");
        if (res.rows.length > 0) {
            console.log('Test User:', JSON.stringify(res.rows[0]));
        } else {
            console.log('No cashier found. Trying admin...');
            const admin = await client.query("SELECT id, email, password, role, branch_id FROM users WHERE role = 'super_admin' LIMIT 1");
            console.log('Admin User:', JSON.stringify(admin.rows[0]));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

getUser();
