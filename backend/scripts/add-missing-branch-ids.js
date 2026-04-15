const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260415_add_missing_branch_ids.sql'), 'utf8');
    await client.query(sql);
    console.log('✓ Added branch_id columns to 5 tables');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

run();
