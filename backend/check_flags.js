const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Check some staff members
    const res = await client.query(`
      SELECT id, first_name, last_name, shif_enabled, nssf_enabled, uniform_enabled 
      FROM staff_profiles 
      ORDER BY created_at DESC 
      LIMIT 10;
    `);
    
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
