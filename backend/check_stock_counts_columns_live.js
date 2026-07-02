require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const directUrl = process.env.DATABASE_URL.replace(':6543', ':5432');
  const client = new Client({ connectionString: directUrl }); 
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_counts'
    `);
    console.log('Columns in stock_counts:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
  } catch (e) {
    console.error('Check Error:', e);
  } finally {
    await client.end();
  }
}
run();
