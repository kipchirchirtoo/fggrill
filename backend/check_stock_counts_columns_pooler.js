require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL }); 
  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('PostgREST schema reload notification sent successfully.');
  } catch (e) {
    console.error('Notify Error:', e);
  } finally {
    await client.end();
  }
}
run();
