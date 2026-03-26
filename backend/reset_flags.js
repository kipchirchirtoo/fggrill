const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    
    // Set all to false
    await client.query(`
      UPDATE staff_profiles 
      SET shif_enabled = false, 
          nssf_enabled = false, 
          uniform_enabled = false;
    `);
    
    console.log("Successfully reset all statutory flags to false.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

run();
