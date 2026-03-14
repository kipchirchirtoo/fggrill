const { Client } = require('pg');
require('dotenv').config();

async function checkRoles() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    const res = await client.query('SELECT email, role, pos_pin FROM users LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}

checkRoles();
