const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client } = require('pg');

async function test(connectionString, label) {
  console.log(`Testing ${label}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log(`✅ ${label} connected successfully!`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ ${label} failed: ${err.message}`);
    return false;
  }
}

async function run() {
  const url6543 = process.env.DATABASE_URL;
  const url5432 = url6543.replace(':6543', ':5432');
  
  // Try direct host
  const directUrl = "postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@db.rvoaowhxyweswwuxbrzm.supabase.co:5432/postgres";

  await test(url6543, 'Pooler 6543');
  await test(url5432, 'Pooler 5432');
  await test(directUrl, 'Direct DB 5432');
}

run();
