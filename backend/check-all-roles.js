const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function checkRoles() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    const res = await client.query('SELECT DISTINCT role FROM users');
    fs.writeFileSync('roles_output.json', JSON.stringify(res.rows, null, 2));
    await client.end();
}

checkRoles();
