require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const ROOT = path.resolve(__dirname, '..', '..');
const FILES = [
  'database/migrations/20260625_cashier_void_audit.sql',
  'backend/migrations/20260627_kitchen_pos_consumption_item_index.sql',
  'backend/migrations/20260627_cashier_shift_expenses.sql',
  'backend/migrations/20260627_kitchen_void_stage.sql'
];

(async () => {
  const client = await pool.connect();
  try {
    for (const relPath of FILES) {
      const fullPath = path.join(ROOT, relPath);
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`\n=== Running ${relPath} ===`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`OK: ${relPath}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED: ${relPath}`);
        console.error(err.message);
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
