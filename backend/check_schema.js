require('dotenv').config();
const { Client } = require('pg');

async function checkSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_counts'
    `);
        console.log("Columns for stock_counts:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error("Error connecting or querying:", err);
    } finally {
        await client.end();
    }
}

checkSchema();
