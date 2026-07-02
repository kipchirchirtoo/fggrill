const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sqlPath = 'C:\\Users\\user\\OneDrive\\Desktop\\fggrill\\backend\\database\\migrations\\20260625_rls_hardening_direct_reads.sql';
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(sql);
    console.log('✅ Migration completed successfully.');
  } catch (e) {
    console.error('❌ Migration failed:', e);
  } finally {
    await client.end();
  }
}
run();
