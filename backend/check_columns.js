require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL }); 
  await client.connect();
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'kitchen_stock'");
  console.log('kitchen_stock columns:', res.rows.map(r => r.column_name));
  await client.end();
}
run();
