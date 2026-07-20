/**
 * Simple migration runner — applies a single SQL file against DATABASE_URL.
 * Usage:  node scripts/migrate.js <path-to-sql-file>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/migrate.js <path-to-sql-file>');
  process.exit(1);
}

const resolved = path.resolve(sqlFile);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const sql = fs.readFileSync(resolved, 'utf8');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log(`Running migration: ${resolved}`);
    await client.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
