const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const parsedUrl = new URL(process.env.DATABASE_URL.replace(':6543', ':5432'));
  parsedUrl.hostname = '34.241.16.247';
  const connectionString = parsedUrl.toString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    const result = await client.query(`
      SELECT o.name as outlet_name, count(*) as total_items, sum(case when poi.is_available then 1 else 0 end) as available_items
      FROM pos_outlet_items poi
      JOIN pos_outlets o ON o.id = poi.outlet_id
      GROUP BY o.name
      ORDER BY o.name;
    `);

    console.table(result.rows);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
