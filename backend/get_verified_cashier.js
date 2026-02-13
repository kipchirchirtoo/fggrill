const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function getCashier() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query("SELECT id, role, branch_id FROM users WHERE role = 'cashier' LIMIT 1");

        if (res.rows.length > 0) {
            console.log('Cashier User:', JSON.stringify(res.rows[0]));
        } else {
            console.log('No cashier found. Checking available roles...');
            const rolesRes = await client.query("SELECT DISTINCT role FROM users");
            console.log('Roles:', rolesRes.rows.map(r => r.role).join(', '));

            // Fallback to super_admin if no cashier
            const adminRes = await client.query("SELECT id, role, branch_id FROM users WHERE role = 'super_admin' LIMIT 1");
            if (adminRes.rows.length > 0) {
                console.log('Using Super Admin as fallback:', JSON.stringify(adminRes.rows[0]));
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

getCashier();
