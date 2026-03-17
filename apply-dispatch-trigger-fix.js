const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected\n');

    const sql = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/40_fix_dispatch_trigger_item_name.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Trigger function updated — dispatch confirm should work now');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
