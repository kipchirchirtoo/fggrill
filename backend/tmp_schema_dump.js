require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const KEYWORDS = [
  'pos_', 'order', 'staff', 'waiter', 'bartend', 'cashier', 'credit',
  'account', 'shift', 'user', 'outlet', 'bill', 'restaurant_', 'kitchen',
  'branch', 'profile', 'sale', 'transaction', 'float', 'kyogong'
];

async function main() {
  const client = await pool.connect();
  try {
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    const allTables = tablesRes.rows.map(r => r.table_name);
    const relevant = allTables.filter(t =>
      KEYWORDS.some(k => t.toLowerCase().includes(k))
    );

    const result = { allTablesCount: allTables.length, allTables, relevantTables: relevant, columns: {} };

    for (const table of relevant) {
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      result.columns[table] = colsRes.rows;
    }

    // Foreign keys for relevant tables
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
      ORDER BY tc.table_name;
    `);
    result.foreignKeys = fkRes.rows;

    fs.writeFileSync('tmp_schema_dump.json', JSON.stringify(result, null, 2));
    console.log('Done. Relevant tables:', relevant.length, 'of', allTables.length);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
