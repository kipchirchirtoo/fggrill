const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    await client.connect();
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'accounting_chart_of_accounts'
    `);
    console.log('Columns for accounting_chart_of_accounts:', res.rows);
    await client.end();
}

check();
