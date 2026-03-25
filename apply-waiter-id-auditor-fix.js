/**
 * Fix: Add waiter_id to restaurant_orders + create missing auditor user row
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set in backend/.env');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const sql = fs.readFileSync(
      path.join(__dirname, 'backend/supabase/migrations/20260324_fix_waiter_id_and_auditor_user.sql'),
      'utf8'
    );
    console.log('🚀 Applying fix: waiter_id FK + auditor user row...');
    await client.query(sql);
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('\nRun manually in Supabase SQL Editor:');
    console.error('  backend/supabase/migrations/20260324_fix_waiter_id_and_auditor_user.sql');
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
