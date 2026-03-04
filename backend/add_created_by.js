require('dotenv').config();
const { Client } = require('pg');

async function checkFKs() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("Adding created_by column to stock_counts...");
        await client.query(`
      ALTER TABLE stock_counts 
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
    `);

        console.log("Schema cache reload triggered...");
        await client.query(`NOTIFY pgrst, 'reload schema'`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkFKs();
