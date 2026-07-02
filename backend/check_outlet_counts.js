require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL.replace('aws-0-eu-west-1.pooler.supabase.com', '34.241.16.247');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT o.name, i.outlet_id, COUNT(*) 
    FROM pos_outlet_items i 
    JOIN pos_outlets o ON i.outlet_id = o.id 
    GROUP BY o.name, i.outlet_id
  `);
  console.table(res.rows);
  await client.end();
}
run();
