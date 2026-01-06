const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
});

async function test() {
    console.log('Connecting...');
    try {
        await client.connect();
        console.log('Connected!');
        const res = await client.query('SELECT NOW()');
        console.log('Success:', res.rows[0]);
    } catch (err) {
        console.error('Failure:', err.message);
    } finally {
        await client.end();
    }
    process.exit(0);
}

test();
