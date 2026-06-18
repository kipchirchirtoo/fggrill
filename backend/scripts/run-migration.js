const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration.js <path-to-migration.sql>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set in backend/.env');
  process.exit(1);
}

const sql = fs.readFileSync(migrationFile, 'utf8');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(sql)
  .then(() => {
    console.log('Migration applied successfully:', path.basename(migrationFile));
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err.message);
    pool.end();
    process.exit(1);
  });
