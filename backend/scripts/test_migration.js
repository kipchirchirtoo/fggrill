const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/test_migration.js <migration-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        console.log(`✅ Statement ${i + 1} parsed/executed OK`);
      } catch (err) {
        console.error(`❌ Statement ${i + 1} failed:`);
        console.error(err.message);
        console.error('---');
        console.error(stmt.slice(0, 500));
        console.error('---');
        throw err;
      }
    }
    await client.query('ROLLBACK');
    console.log('All statements parsed/executed OK (rolled back).');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e); process.exit(1); });
