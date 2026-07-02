require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  await client.connect();
  const res = await client.query(`
    SELECT 
      COUNT(*) AS total_items,
      SUM(CASE WHEN is_active IS NULL THEN 1 ELSE 0 END) AS null_active,
      SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) AS true_active,
      SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) AS false_active,
      SUM(CASE WHEN is_available IS NULL THEN 1 ELSE 0 END) AS null_available,
      SUM(CASE WHEN is_available = true THEN 1 ELSE 0 END) AS true_available,
      SUM(CASE WHEN is_available = false THEN 1 ELSE 0 END) AS false_available
    FROM pos_outlet_items;
  `);
  console.table(res.rows);
  await client.end();
}
run();
